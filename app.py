import os
import logging
import json
import base64
import zipfile
import tempfile
from io import BytesIO
from datetime import datetime

from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from circuit_model import OntologyBuilderUnified, simulate_circuit
from constants import COMPONENT_CONSTANTS

def generate_equation_display(builder, result):
    """Generate human-readable equation representations for each protein"""
    equations = {}
    
    if 'protein_mapping' not in result or not result['protein_mapping']:
        return equations
    
    # Get the protein mapping and regulations
    protein_mapping = result['protein_mapping']
    regulations = builder.regulations
    
    # Create reverse mapping: CDS name -> Protein display name
    cds_to_protein = {cds_name: protein_name for protein_name, cds_name in protein_mapping.items()}
    
    for protein_name, cds_name in protein_mapping.items():
        equation_parts = []
        
        # Find regulations affecting this protein's promoter
        # First find the promoter that controls this CDS
        controlling_promoter = None
        for circuit in builder.circuits:
            for i, comp in enumerate(circuit['components']):
                if comp['name'] == cds_name and comp['type'] == 'cds':
                    # Look backwards for the promoter
                    for j in range(i-1, -1, -1):
                        if circuit['components'][j]['type'] == 'promoter':
                            controlling_promoter = circuit['components'][j]['name']
                            break
                    break
            if controlling_promoter:
                break
        
        if not controlling_promoter:
            continue
            
        # Find regulations targeting this promoter  
        affecting_regs = [reg for reg in regulations if reg['target'] == controlling_promoter]
        
        # Check for constitutive regulation
        constitutive_regs = [reg for reg in regulations if reg.get('type') == 'constitutive' and reg.get('target') == controlling_promoter]
        
        if not affecting_regs or (len(affecting_regs) == 1 and affecting_regs[0].get('type') == 'constitutive'):
            # Constitutive expression - use simplified protein name
            simple_protein_name = protein_name.split(',')[0]  # "Protein A.1, Gene 1" -> "Protein A.1"
            # Further simplify for LaTeX: "Protein A.1" -> "Protein A" (remove gene info)
            latex_name = simple_protein_name.replace(', Gene', '').strip()
            
            equations[protein_name] = {
                'latex': f"\\frac{{d[{latex_name}]}}{{dt}} = k_{{prod}} - \\gamma \\cdot [{latex_name}]",
                'description': "Constitutive protein production with degradation",
                'components': ["Production rate (k_prod)", "Degradation rate (γ)"]
            }
        else:
            # Build regulation-based equation
            reg_descriptions = []
            latex_terms = []
            simple_protein_name = protein_name.split(',')[0]  # "Protein A.1, Gene 1" -> "Protein A.1"
            # Further simplify for LaTeX: remove gene info
            latex_name = simple_protein_name.replace(', Gene', '').strip()
            
            for reg in affecting_regs:
                reg_type = reg['type']
                source = reg['source']
                params = reg.get('parameters', {})
                
                if 'repression' in reg_type:
                    # Get hill coefficient (n) from parameters
                    n = params.get('n', 2)  # Default to 2 if not specified
                    if 'self' in reg_type:
                        reg_descriptions.append(f"Self-repression by {simple_protein_name} (n={n})")
                        latex_terms.append(f"\\frac{{1}}{{1 + \\left(\\frac{{[{latex_name}]}}{{K_r}}\\right)^{n}}}")
                    else:
                        # Convert source CDS name to protein display name
                        source_protein = cds_to_protein.get(source, source)
                        simple_source_name = source_protein.split(',')[0] if ',' in source_protein else source_protein
                        latex_source_name = simple_source_name.replace(', Gene', '').strip()
                        reg_descriptions.append(f"Repression by {simple_source_name} (n={n})")
                        latex_terms.append(f"\\frac{{1}}{{1 + \\left(\\frac{{[{latex_source_name}]}}{{K_r}}\\right)^{n}}}")
                        
                elif 'activation' in reg_type:
                    # Get hill coefficient (n) from parameters
                    n = params.get('n', 2)  # Default to 2 if not specified
                    if 'self' in reg_type:
                        reg_descriptions.append(f"Self-activation by {simple_protein_name} (n={n})")
                        latex_terms.append(f"\\frac{{[{latex_name}]^{n}}}{{K_a^{n} + [{latex_name}]^{n}}}")
                    else:
                        # Convert source CDS name to protein display name
                        source_protein = cds_to_protein.get(source, source)
                        simple_source_name = source_protein.split(',')[0] if ',' in source_protein else source_protein
                        latex_source_name = simple_source_name.replace(', Gene', '').strip()
                        reg_descriptions.append(f"Activation by {simple_source_name} (n={n})")
                        latex_terms.append(f"\\frac{{[{latex_source_name}]^{n}}}{{K_a^{n} + [{latex_source_name}]^{n}}}")
            
            # Combine terms
            if latex_terms:
                if len(latex_terms) == 1:
                    regulation_term = latex_terms[0]
                else:
                    regulation_term = " \\cdot ".join(latex_terms)
                
                equations[protein_name] = {
                    'latex': f"\\frac{{d[{latex_name}]}}{{dt}} = k_{{prod}} \\cdot {regulation_term} - \\gamma \\cdot [{latex_name}]",
                    'description': "; ".join(reg_descriptions),
                    'components': reg_descriptions + ["Degradation rate (γ)"]
                }
            
    return equations

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")
CORS(app)

# Initialize circuit model with constants
circuit_builder = OntologyBuilderUnified(COMPONENT_CONSTANTS)

@app.route('/')
def loading():
    """Main simulator page with drag-and-drop interface"""
    return render_template('loading.html')

@app.route('/dial')
def dial():
    """Dial mode page for parameter adjustment"""
    return render_template('dial.html')

@app.route('/eeprom')
def eeprom():
    """EEPROM control page for hardware integration"""
    return render_template('eeprom.html')

@app.route('/about')
def about():
    """About page with team information"""
    return render_template('about.html')

@app.route('/simulate', methods=['POST'])
def simulate():
    """Enhanced simulation endpoint using Version 15.3 modeling"""
    try:
        data = request.get_json()
        
        if not data or 'cellboard' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Invalid request data. Expected cellboard configuration.'
            }), 400
        
        cellboard = data['cellboard']
        dial_data = data.get('dial', {})
        
        # Convert cellboard format to hardware txt file format
        placed_components = []
        
        # Collect all placed components with their positions
        for component_type, components in cellboard.items():
            for comp in components:
                x = int(comp.get('x', 0))
                y = int(comp.get('y', 0))
                gene = comp.get('gene', 'Gene 1')
                strength = comp.get('strength', 'norm')
                
                # Convert position to MUX/Channel format
                channel = y * 8 + x
                mux_letter = 'A'  # Start with MUX A for simplicity
                
                # Create component identifier using hardware naming convention
                gene_letter = gene.split()[-1].lower() if 'Gene' in gene else 'a'
                
                # Map component types to hardware naming convention
                type_map = {
                    'Promoter': 'promoter',
                    'RBS': 'rbs', 
                    'CDS': 'cds',
                    'Terminator': 'terminator',
                    'Repressor Start': 'repressor_start',
                    'Repressor End': 'repressor_end',
                    'Activator Start': 'activator_start',
                    'Activator End': 'activator_end',
                    'Inducer Start': 'inducer_start',
                    'Inducer End': 'inducer_end',
                    'Inhibitor Start': 'inhibitor_start',
                    'Inhibitor End': 'inhibitor_end'
                }
                
                base_type = type_map.get(component_type, component_type.lower().replace(' ', '_'))
                comp_name = f"{base_type}_{gene_letter}"
                
                placed_components.append({
                    'channel': channel,
                    'mux': mux_letter,
                    'name': comp_name,
                    'type': component_type,
                    'strength': strength,
                    'gene': gene,
                    'position': channel  # For sorting
                })
        
        # Sort by position to create ordered circuit
        placed_components.sort(key=lambda x: x['position'])
        
        # Create hardware txt file format lines
        final_lines = []
        last_pos = -1
        
        for comp in placed_components:
            pos = comp['position']
            # Add circuit break if there's a significant gap
            if last_pos >= 0 and pos - last_pos > 2:
                final_lines.append("")  # Circuit break
            
            # Create MUX/Channel line in exact hardware format with strength info
            mux_line = f"MUX {comp['mux']}, Channel {comp['channel']}:  ['{comp['name']}'] strength={comp['strength']}"
            final_lines.append(mux_line)
            last_pos = pos
        
        if not final_lines:
            return jsonify({
                'status': 'error',
                'message': 'No components placed on the board. Please place some components first.'
            }), 400
        
        # Apply dial adjustments to constants if provided
        adjusted_constants = COMPONENT_CONSTANTS.copy()
        
        # Group dial parameters into component-specific overrides
        if dial_data:
            print(f"Applying dial parameters: {dial_data}")
            
            # Create component-specific override groups from dial data
            override_groups = {
                'promoter': {},
                'rbs': {},
                'cds': {},
                'repressor': {}
            }
            
            # Map dial parameters to component types with per-gene specificity
            gene_overrides = {
                '1': {'promoter': {}, 'rbs': {}, 'cds': {}, 'terminator': {}},
                '2': {'promoter': {}, 'rbs': {}, 'cds': {}, 'terminator': {}},
                '3': {'promoter': {}, 'rbs': {}, 'cds': {}, 'terminator': {}}
            }
            
            # Parse gene-specific parameters
            for param_name, value in dial_data.items():
                try:
                    # Check for gene-specific parameter patterns
                    if param_name.startswith('promoter') and '_strength' in param_name:
                        gene_num = param_name.replace('promoter', '').replace('_strength', '')
                        if gene_num in gene_overrides:
                            gene_overrides[gene_num]['promoter']['strength'] = float(value)
                    elif param_name.startswith('rbs') and '_efficiency' in param_name:
                        gene_num = param_name.replace('rbs', '').replace('_efficiency', '')
                        if gene_num in gene_overrides:
                            gene_overrides[gene_num]['rbs']['efficiency'] = float(value)
                    elif param_name.startswith('cds') and '_translation_rate' in param_name:
                        gene_num = param_name.replace('cds', '').replace('_translation_rate', '')
                        if gene_num in gene_overrides:
                            gene_overrides[gene_num]['cds']['translation_rate'] = float(value)
                    elif param_name.startswith('cds') and '_degradation_rate' in param_name:
                        gene_num = param_name.replace('cds', '').replace('_degradation_rate', '')
                        if gene_num in gene_overrides:
                            gene_overrides[gene_num]['cds']['degradation_rate'] = float(value)
                    elif param_name.startswith('terminator') and '_efficiency' in param_name:
                        gene_num = param_name.replace('terminator', '').replace('_efficiency', '')
                        if gene_num in gene_overrides:
                            gene_overrides[gene_num]['terminator']['efficiency'] = float(value)
                    elif param_name.startswith('protein') and '_initial_conc' in param_name:
                        gene_num = param_name.replace('protein', '').replace('_initial_conc', '')
                        if gene_num in gene_overrides:
                            gene_overrides[gene_num]['cds']['init_conc'] = float(value)
                    # Handle generic parameters for backwards compatibility
                    elif param_name in ['strength', 'efficiency', 'translation_rate', 'degradation_rate']:
                        if param_name == 'strength':
                            override_groups['promoter']['strength'] = float(value)
                        elif param_name == 'efficiency':
                            override_groups['rbs']['efficiency'] = float(value)
                        elif param_name == 'translation_rate':
                            override_groups['cds']['translation_rate'] = float(value)
                        elif param_name == 'degradation_rate':
                            override_groups['cds']['degradation_rate'] = float(value)
                    # Handle repressor parameters  
                    elif param_name == 'binding_affinity':
                        override_groups['repressor']['Kr'] = 1.0 / max(0.01, float(value))
                    elif param_name == 'cooperativity':
                        override_groups['repressor']['n'] = float(value)
                except (ValueError, TypeError):
                    continue
            

            
            # Apply gene-specific overrides first (highest priority)
            for comp_name in adjusted_constants:
                comp_type = adjusted_constants[comp_name].get('type', '')
                
                # Check if this is a gene-specific component (promoter_1, rbs_2, cds_3, etc.)
                gene_num = None
                if '_' in comp_name:
                    parts = comp_name.split('_')
                    if len(parts) >= 2 and parts[1].isdigit():
                        gene_num = parts[1]
                
                # Apply gene-specific overrides if available
                if gene_num and gene_num in gene_overrides:
                    if comp_type in gene_overrides[gene_num]:
                        for param_name, override_value in gene_overrides[gene_num][comp_type].items():
                            if param_name in adjusted_constants[comp_name]:
                                adjusted_constants[comp_name][param_name] = override_value
                                print(f"Applied gene-specific override: {comp_name}.{param_name} = {override_value}")
            
            # Apply generic component-specific overrides (fallback for non-gene-specific components)
            for comp_name in adjusted_constants:
                comp_type = adjusted_constants[comp_name].get('type', '')
                
                if comp_type in override_groups:
                    for param_name, override_value in override_groups[comp_type].items():
                        if param_name in adjusted_constants[comp_name]:
                            # Only apply if not already overridden by gene-specific parameter
                            adjusted_constants[comp_name][param_name] = override_value
                            print(f"Applied generic override: {comp_name}.{param_name} = {override_value}")
            
            # Apply global multipliers AFTER overrides (so they affect the final values)
            for comp_name in adjusted_constants:
                comp_type = adjusted_constants[comp_name].get('type', '')
                
                # Apply global multipliers to the final parameter values
                if 'global_transcription_rate' in dial_data and comp_type == 'promoter':
                    try:
                        multiplier = float(dial_data['global_transcription_rate'])
                        if 'strength' in adjusted_constants[comp_name]:
                            original_val = adjusted_constants[comp_name]['strength']
                            adjusted_constants[comp_name]['strength'] = original_val * multiplier
                            print(f"Applied global transcription multiplier: {comp_name}.strength = {original_val} * {multiplier} = {original_val * multiplier}")
                    except (ValueError, TypeError):
                        pass
                
                if 'global_translation_rate' in dial_data:
                    try:
                        multiplier = float(dial_data['global_translation_rate'])
                        if comp_type == 'cds' and 'translation_rate' in adjusted_constants[comp_name]:
                            original_val = adjusted_constants[comp_name]['translation_rate']
                            adjusted_constants[comp_name]['translation_rate'] = original_val * multiplier
                            print(f"Applied global translation multiplier: {comp_name}.translation_rate = {original_val} * {multiplier} = {original_val * multiplier}")
                        if comp_type == 'rbs' and 'efficiency' in adjusted_constants[comp_name]:
                            original_val = adjusted_constants[comp_name]['efficiency']
                            adjusted_constants[comp_name]['efficiency'] = original_val * multiplier
                            print(f"Applied global translation multiplier: {comp_name}.efficiency = {original_val} * {multiplier} = {original_val * multiplier}")
                    except (ValueError, TypeError):
                        pass
                
                if 'global_degradation_rate' in dial_data and comp_type == 'cds':
                    try:
                        multiplier = float(dial_data['global_degradation_rate'])
                        if 'degradation_rate' in adjusted_constants[comp_name]:
                            original_val = adjusted_constants[comp_name]['degradation_rate']
                            adjusted_constants[comp_name]['degradation_rate'] = original_val * multiplier
                            print(f"Applied global degradation multiplier: {comp_name}.degradation_rate = {original_val} * {multiplier} = {original_val * multiplier}")
                    except (ValueError, TypeError):
                        pass
            
            print(f"Applied dial overrides - Gene-specific: {len([k for k in gene_overrides.values() if any(v for v in k.values())])}, Generic: {len(override_groups)}")
            print("DEBUG: Received dial parameters:", list(dial_data.keys()))
        
        # Debug: Show the converted hardware txt format
        print("=== CONVERTED HARDWARE TXT FORMAT ===")
        for line in final_lines:
            print(f"  {line}")
        print("=====================================")
        
        # Create new builder with adjusted constants
        builder = OntologyBuilderUnified(adjusted_constants)
        
        # Parse the component lines
        builder.parse_text_file(final_lines)
        builder.build()
        
        # Run simulation
        result = simulate_circuit(builder)
        
        if result['status'] == 'error':
            return jsonify(result), 400
            
        # Generate equation representations
        equations = generate_equation_display(builder, result)
        
        # Generate plot
        plt.figure(figsize=(10, 6))
        
        if 'time_series' in result and result['time_series']:
            times = result['time_series']['time']
            
            for protein, concentrations in result['time_series'].items():
                if protein != 'time':
                    plt.plot(times, concentrations, label=protein, linewidth=2)
            
            plt.xlabel('Time (hours)')
            plt.ylabel('Protein Concentration (μM)')
            plt.title('Genetic Circuit Dynamics')
            plt.legend()
            plt.grid(True, alpha=0.3)
            
        else:
            # Create summary plot if no time series
            circuits = result.get('circuits', [])
            if circuits:
                circuit_names = [f"Circuit {i+1}" for i in range(len(circuits))]
                component_counts = [len(c.get('components', [])) for c in circuits]
                
                plt.bar(circuit_names, component_counts, color=['#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0'][:len(circuits)])
                plt.xlabel('Circuits')
                plt.ylabel('Number of Components')
                plt.title('Circuit Composition')
            else:
                plt.text(0.5, 0.5, 'No valid circuits detected', 
                        ha='center', va='center', transform=plt.gca().transAxes)
                plt.title('Circuit Analysis Results')
        
        # Convert plot to base64
        buffer = BytesIO()
        plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
        buffer.seek(0)
        plot_data = base64.b64encode(buffer.getvalue()).decode()
        plt.close()
        
        # Prepare detailed response
        response_data = {
            'status': 'success',
            'plot': plot_data,
            'circuits': result.get('circuits', []),
            'regulations': result.get('regulations', []),
            'unpaired_regulators': result.get('unpaired_regulators', []),
            'equations': equations,
            'protein_mapping': result.get('protein_mapping', {}),
            'time_series': result.get('time_series', {}),
            'components_analyzed': len(placed_components),
            'errors': result.get('errors', []),
            'warnings': result.get('warnings', [])
        }
        
        # Add circuit validation messages
        if result.get('regulator_issues'):
            response_data['warnings'].extend([
                f"Regulator issue: {issue.get('issue', str(issue))}" for issue in result['regulator_issues']
            ])
        
        if result.get('unpaired_regulators'):
            response_data['warnings'].extend([
                f"Unpaired regulator: {reg.get('label', str(reg))}" for reg in result['unpaired_regulators']
            ])
        
        return jsonify(response_data)
        
    except Exception as e:
        logging.error(f"Simulation error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Simulation failed: {str(e)}'
        }), 500

@app.route('/api/components')
def get_components():
    """Get available components and their properties"""
    components = {
        'Promoter': {'color': '#FF6B6B', 'genes': ['1', '2', '3']},
        'Terminator': {'color': '#4ECDC4', 'genes': ['1', '2', '3']},
        'RBS': {'color': '#FFD166', 'genes': ['1', '2', '3']},
        'CDS': {'color': '#06D6A0', 'genes': ['1', '2', '3']},
        'Repressor Start': {'color': '#A78BFA', 'genes': ['1', '2', '3']},
        'Repressor End': {'color': '#7E22CE', 'genes': ['1', '2', '3']},
        'Activator Start': {'color': '#3B82F6', 'genes': ['1', '2', '3']},
        'Activator End': {'color': '#1E40AF', 'genes': ['1', '2', '3']}
    }
    return jsonify(components)

@app.route('/api/constants')
def get_constants():
    """Get current component constants for dial mode"""
    return jsonify(COMPONENT_CONSTANTS)

@app.route('/interpret_hardware', methods=['POST'])
def interpret_hardware():
    """Interpret hardware board data from EEPROM scan logs"""
    try:
        data = request.json or {}
        log_lines = data.get('log_lines', [])
        
        if not log_lines:
            return jsonify({
                'status': 'error',
                'message': 'No log lines provided'
            }), 400
        
        # Parse the hardware log lines to extract component data
        channel_data = parse_hardware_log(log_lines)
        
        # Convert to cellboard format
        cellboard = convert_hardware_to_cellboard(channel_data)
        
        # Calculate actual component count (exclude _scan_stats)
        actual_component_count = sum(
            len(components) for key, components in channel_data.items() 
            if key != '_scan_stats' and isinstance(components, list)
        )
        
        return jsonify({
            'status': 'success',
            'channel_data': channel_data,
            'cellboard': cellboard,
            'component_count': actual_component_count
        })
        
    except Exception as e:
        logging.error(f"Hardware interpretation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Hardware interpretation failed: {str(e)}'
        }), 500

def parse_hardware_log_old(log_lines):
    """Parse EEPROM log lines to extract component information"""
    import re
    
    channel_data = {}
    current_channel = None
    fail_count = 0
    scan_count = 0
    
    for line in log_lines:
        line = line.strip()
        
        # Look for MUX selection commands
        cmd_match = re.search(r'>\s*sm\s+([ab])\s+(\d+)', line, re.IGNORECASE)
        if cmd_match:
            mux_letter = cmd_match.group(1).upper()
            channel_num = int(cmd_match.group(2))
            current_channel = f"MUX_{mux_letter}_CH_{channel_num}"
            continue
        
        # Count scan attempts and failures
        if current_channel and line == "fail":
            fail_count += 1
            scan_count += 1
            continue
            
        # Look for any hex data that might indicate EEPROM content
        hex_pattern = re.search(r'([0-9A-Fa-f]{2}(?:\s+[0-9A-Fa-f]{2})+)', line)
        if current_channel and hex_pattern:
            scan_count += 1
            hex_data = hex_pattern.group(1)
            # Log what we're seeing for debugging
            print(f"Raw hex data on {current_channel}: {hex_data}")
            
            hex_bytes = [int(b, 16) for b in hex_data.split()]
            
            # Convert to ASCII and look for any readable content
            ascii_chars = []
            for byte_val in hex_bytes:
                if 32 <= byte_val <= 126:  # Printable ASCII
                    ascii_chars.append(chr(byte_val))
                elif byte_val == 0:  # Null terminator
                    break
                else:
                    ascii_chars.append('.')  # Non-printable placeholder
            
            ascii_str = ''.join(ascii_chars).strip()
            
            # Be more lenient - detect any non-empty data
            if ascii_str and len(ascii_str.replace('.', '')) > 0:
                if current_channel not in channel_data:
                    channel_data[current_channel] = []
                
                # Look for component identifiers more flexibly
                # Check for common component patterns
                component_found = False
                
                # Initialize channel data if not exists
                if current_channel not in channel_data:
                    channel_data[current_channel] = []
                    
                # Split the ASCII string into individual components (comma-separated or space-separated)
                components = re.split(r'[,\s]+', ascii_str.strip())
                
                for comp in components:
                    comp = comp.strip()
                    if not comp or comp == '.' or len(comp) < 2:
                        continue
                    
                    # Map to Excel file component naming format
                    comp_lower = comp.lower()
                    
                    # Promoters - using Excel naming format
                    if comp_lower in ['omo', 'promotor_a', 'promotor_b', 'promotor_c', 'promotor_d', 'promotor_e', 'promotor_f'] or 'promotor' in comp_lower:
                        channel_data[current_channel].append(comp)  # Keep original name
                        print(f"Found promoter on {current_channel}: {comp}")
                        
                    # RBS - using Excel naming format  
                    elif comp_lower.startswith('rbs') or comp_lower in ['rbs_a', 'rbs_b', 'rbs_c', 'rbs_d', 'rbs_e', 'rbs_f', 'rbs_g', 'rbs_h']:
                        channel_data[current_channel].append(comp)  # Keep original name
                        print(f"Found RBS on {current_channel}: {comp}")
                        
                    # CDS - using Excel naming format
                    elif comp_lower.startswith('cds') or comp_lower in ['cds_a', 'cds_b', 'cds_c', 'cds_d', 'cds_e', 'cds_f', 'cds_g', 'cds_h']:
                        channel_data[current_channel].append(comp)  # Keep original name
                        print(f"Found CDS on {current_channel}: {comp}")
                        
                    # Terminators - using Excel naming format
                    elif comp_lower.startswith('terminator') or comp_lower in ['terminator_a', 'terminator_b', 'terminator_c', 'terminator_d', 'terminator_e', 'terminator_f', 'termi']:
                        channel_data[current_channel].append(comp)  # Keep original name
                        print(f"Found terminator on {current_channel}: {comp}")
                        
                    # Repressors - using Excel naming format (start/end pairs) and your "r_a" format
                    elif (comp_lower.startswith('repressor') or 
                          comp_lower.startswith('r_') or 
                          'repressor' in comp_lower or
                          comp_lower in ['r_a', 'r_b']):  # Specifically handle your r_a format
                        channel_data[current_channel].append(comp)  # Keep original name
                        print(f"Found repressor on {current_channel}: {comp}")
                        
                    # Activators - using Excel naming format (start/end pairs)  
                    elif comp_lower.startswith('activator') or 'activator' in comp_lower:
                        channel_data[current_channel].append(comp)  # Keep original name
                        print(f"Found activator on {current_channel}: {comp}")
                        
                    # Operators - mapping your "or" to appropriate Excel format
                    elif comp_lower in ['or', 'or_a', 'operator']:
                        channel_data[current_channel].append(comp)  # Keep original name
                        print(f"Found operator on {current_channel}: {comp}")
                    
                    else:
                        # Keep unknown components for debugging
                        channel_data[current_channel].append(comp)
                        print(f"Found component on {current_channel}: {comp}")
            continue
        
        # Parse hex dump lines (format: "00: 68 65 6C 6C ...")
        if current_channel and re.match(r'^[0-7][0-9A-Fa-f]:', line):
            scan_count += 1
            parts = line.split(':')
            if len(parts) == 2:
                # Get just the hex part, ignore the ASCII representation part
                hex_part = parts[1].strip()
                # Remove the ASCII part (everything after multiple spaces or dots)
                hex_part = re.split(r'\s{3,}|\.\.\.|[a-zA-Z]{3,}', hex_part)[0]
                hex_values = hex_part.split()
                
                component_string = ''
                
                # Convert hex to ASCII more carefully
                for hex_val in hex_values:
                    if len(hex_val) == 2:
                        try:
                            char_code = int(hex_val, 16)
                            if 32 <= char_code <= 126:  # Printable ASCII
                                component_string += chr(char_code)
                            elif char_code == 0:  # Null terminator - stop reading
                                break
                        except ValueError:
                            continue
                
                # Extract component identifiers
                if component_string.strip():
                    if current_channel not in channel_data:
                        channel_data[current_channel] = []
                    
                    # Split on null characters or whitespace and process each component
                    components = re.split(r'[\x00\s]+', component_string.strip())
                    for comp in components:
                        comp = comp.strip()
                        if comp and comp not in channel_data[current_channel]:
                            channel_data[current_channel].append(comp)
    
    # Log scan results
    success_count = len([ch for ch in channel_data if channel_data[ch]])
    print(f"Board scan results: {success_count} channels with data, {fail_count} failed reads, {scan_count} total scans")
    
    # Add scan statistics to the data
    channel_data['_scan_stats'] = {
        'total_scans': scan_count,
        'failed_reads': fail_count,
        'successful_channels': success_count
    }
    
    return channel_data

def parse_hardware_log(log_lines):
    """Improved parsing that accumulates hex data per channel"""
    import re
    
    channel_hex = {}  # Accumulate hex data per channel
    current_channel = None
    fail_count = 0
    scan_count = 0
    
    # First pass: accumulate all hex data per channel
    for line in log_lines:
        line = line.strip()
        
        # Look for MUX selection commands
        cmd_match = re.search(r'>\s*sm\s+([ab])\s+(\d+)', line, re.IGNORECASE)
        if cmd_match:
            mux_letter = cmd_match.group(1).upper()
            channel_num = int(cmd_match.group(2))
            current_channel = f"MUX_{mux_letter}_CH_{channel_num}"
            # Initialize hex accumulator for this channel
            if current_channel not in channel_hex:
                channel_hex[current_channel] = []
            continue
        
        # Count scan attempts and failures
        if current_channel and line == "fail":
            fail_count += 1
            scan_count += 1
            continue
            
        # Extract hex data from lines with address prefixes like "00:" and "40:"
        if current_channel:
            # Check if this line has hex data (address prefix + hex bytes)
            hex_line_match = re.match(r'^([0-9A-Fa-f]{2}):\s*(.+)', line)
            if hex_line_match:
                hex_part = hex_line_match.group(2)
                # Split on multiple spaces or dots to separate hex from ASCII representation
                hex_only = re.split(r'\s{3,}|\.{3,}', hex_part)[0].strip()
                
                # Find all two-digit hex tokens in the hex part only
                hex_tokens = re.findall(r'\b[0-9A-Fa-f]{2}\b', hex_only)
                if hex_tokens:
                    scan_count += 1
                    # Convert hex tokens to integers and accumulate
                    channel_hex[current_channel].extend([int(token, 16) for token in hex_tokens])
    
    # Second pass: process accumulated hex data per channel
    channel_data = {}
    
    for channel, hex_bytes in channel_hex.items():
        if not hex_bytes:
            continue
            
        # Convert accumulated hex bytes to ASCII
        ascii_chars = []
        component_found = False
        
        for byte_val in hex_bytes:
            if 32 <= byte_val <= 126:  # Printable ASCII
                ascii_chars.append(chr(byte_val))
                component_found = True
            elif byte_val == 0:  # Null terminator
                # If we found component data before this null, keep it
                if component_found:
                    ascii_chars.append(' ')  # Replace null with space
                else:
                    ascii_chars.append('')  # Skip leading nulls
            else:
                ascii_chars.append(' ')  # Non-printable to space
        
        ascii_str = ''.join(ascii_chars)
        print(f"Complete ASCII data for {channel}: '{ascii_str.strip()}'")
        
        # Clean and search for component patterns
        if ascii_str.strip():
            # Remove non-alphanumeric except underscore to create continuous string
            compact_str = re.sub(r'[^A-Za-z0-9_]', '', ascii_str).lower()
            
            if compact_str:
                components_found = []
                
                # Search for component patterns (case-insensitive)
                patterns = [
                    (r'(promotor_[a-f])', 'promoter'),  # Normalize promotor to promoter
                    (r'(promoter_[a-f])', 'promoter'),
                    (r'(rbs_[a-h])', 'rbs'),
                    (r'(cds_[a-h])', 'cds'),
                    (r'(terminator_[a-f])', 'terminator'),
                    (r'(r_[a-b])', 'repressor'),
                    (r'(omo)', 'promoter'),  # Special case
                    (r'(termi)', 'terminator')  # Special case
                ]
                
                for pattern, comp_type in patterns:
                    matches = re.findall(pattern, compact_str)
                    for match in matches:
                        # Normalize promotor -> promoter for consistency
                        if match.startswith('promotor_'):
                            match = match.replace('promotor_', 'promoter_')
                        components_found.append(match)
                        print(f"Found {comp_type} on {channel}: {match}")
                
                # Remove duplicates while preserving order
                seen = set()
                unique_components = []
                for comp in components_found:
                    if comp not in seen:
                        seen.add(comp)
                        unique_components.append(comp)
                
                if unique_components:
                    channel_data[channel] = unique_components
    
    # Add scan statistics
    success_count = len(channel_data)
    channel_data['_scan_stats'] = {
        'total_scans': scan_count,
        'failed_reads': fail_count,
        'successful_channels': success_count
    }
    
    print(f"Board scan results: {success_count} channels with data, {fail_count} failed reads, {scan_count} total scans")
    
    return channel_data

def convert_hardware_to_cellboard(channel_data):
    """Convert hardware channel data to cellboard format"""
    import re
    
    cellboard = {}
    
    # Component type mapping
    type_mapping = {
        'promoter': 'Promoter',
        'promotor': 'Promoter', 
        'prom': 'Promoter',
        'omo': 'Promoter',  # Your specific promoter name
        'terminator': 'Terminator',
        'term': 'Terminator',
        'termi': 'Terminator',  # Your specific terminator name
        'rbs': 'RBS',
        'cds': 'CDS',
        'coding': 'CDS',
        'repressor_start': 'Repressor Start',
        'repressor_end': 'Repressor End', 
        'activator_start': 'Activator Start',
        'activator_end': 'Activator End',
        'rep_start': 'Repressor Start',
        'rep_end': 'Repressor End',
        'act_start': 'Activator Start',
        'act_end': 'Activator End',
        'r': 'Repressor Start',  # Your specific repressor format
        'or': 'Operator'  # Your specific operator format
    }
    
    for channel_key, components in channel_data.items():
        # Parse channel position
        match = re.search(r'MUX_([AB])_CH_(\d+)', channel_key)
        if not match:
            continue
            
        mux_letter = match.group(1)
        channel_num = int(match.group(2))
        
        # Map to board position
        linear_pos = channel_num if mux_letter == 'A' else channel_num + 16
        x = linear_pos % 8
        y = linear_pos // 8
        
        for comp_name in components:
            # Handle different component name patterns
            if '_' in comp_name:
                # Pattern like "rbs_c", "cds_d", "terminator_b", "r_a"
                parts = comp_name.split('_')
                comp_type = parts[0].lower()
                gene_suffix = parts[1] if len(parts) > 1 else "1"
            else:
                # Pattern like "omo", "termi", "or"
                comp_type = comp_name.lower()
                gene_suffix = "1"
            
            # Map to friendly type
            friendly_type = type_mapping.get(comp_type)
            if not friendly_type:
                print(f"Warning: Unknown component type '{comp_type}' from name '{comp_name}'")
                continue
            
            # Convert suffix to gene number (a=1, b=2, c=3, etc.)
            if gene_suffix.isalpha() and len(gene_suffix) == 1:
                gene_num = str(ord(gene_suffix.lower()) - ord('a') + 1)
            elif gene_suffix.isdigit():
                gene_num = gene_suffix
            else:
                gene_num = "1"
            
            # Add to cellboard
            if friendly_type not in cellboard:
                cellboard[friendly_type] = []
                
            cellboard[friendly_type].append({
                'gene': f'Gene {gene_num}',
                'strength': 'norm',
                'x': str(x),
                'y': str(y)
            })
    
    return cellboard

@app.route('/export')
def export_project():
    """Export all project files as a ZIP archive"""
    try:
        # Create a temporary directory for the ZIP file
        with tempfile.TemporaryDirectory() as temp_dir:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            zip_filename = f"genetic_circuit_designer_{timestamp}.zip"
            zip_path = os.path.join(temp_dir, zip_filename)
            
            # Create ZIP file
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add main Python files
                main_files = [
                    'app.py',
                    'main.py', 
                    'circuit_model.py',
                    'constants.py',
                    'pyproject.toml',
                    'replit.md'
                ]
                
                for file in main_files:
                    if os.path.exists(file):
                        zipf.write(file, file)
                
                # Add templates directory
                templates_dir = 'templates'
                if os.path.exists(templates_dir):
                    for root, dirs, files in os.walk(templates_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arc_path = os.path.relpath(file_path, '.')
                            zipf.write(file_path, arc_path)
                
                # Add static directory
                static_dir = 'static'
                if os.path.exists(static_dir):
                    for root, dirs, files in os.walk(static_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arc_path = os.path.relpath(file_path, '.')
                            zipf.write(file_path, arc_path)
                
                # Add a README for the exported project
                readme_content = """# Genetic Circuit Designer - Exported Project

This is an exported copy of your Genetic Circuit Designer project.

## Files Included:
- app.py - Main Flask application
- main.py - Entry point for the application
- circuit_model.py - Circuit modeling and simulation engine
- constants.py - Component constants and parameters
- templates/ - HTML templates for the web interface
- static/ - CSS, JavaScript, and other static assets
- pyproject.toml - Project dependencies
- replit.md - Project documentation

## To Run:

### Option 1: Using Virtual Environment (Recommended)
1. Create and activate virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```
2. Install dependencies: `pip install -r requirements.txt`
3. Run the application: `python main.py`
4. Open your browser to http://localhost:5001

### Option 2: Using UV (Fast Package Manager)
1. Install UV: `pip install uv`
2. Install dependencies: `uv pip install -r requirements.txt`
3. Run the application: `python main.py`
4. Open your browser to http://localhost:5001

### Option 3: Direct Installation
1. Install dependencies: `pip install -r requirements.txt`
2. Run the application: `python main.py`
3. Open your browser to http://localhost:5001

**Port Configuration:**
- Uses port 5001 by default to avoid conflicts with macOS AirPlay Receiver on port 5000
- Set PORT environment variable to use different port: `PORT=8000 python main.py`
- To deactivate virtual environment when done: `deactivate`

## Features:
- Drag-and-drop circuit design interface
- Advanced genetic circuit simulation
- Parameter tuning with dial mode
- EEPROM hardware integration
- LaTeX equation display
- Export/import functionality

Generated on: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """
"""
                
                zipf.writestr('README.md', readme_content)
                
                # Create a requirements.txt file from pyproject.toml dependencies
                requirements_content = """flask
flask-cors
numpy
scipy
matplotlib
gunicorn
"""
                zipf.writestr('requirements.txt', requirements_content)
            
            # Send the ZIP file
            return send_file(
                zip_path,
                as_attachment=True,
                download_name=zip_filename,
                mimetype='application/zip'
            )
            
    except Exception as e:
        logging.error(f"Export error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Export failed: {str(e)}'
        }), 500

if __name__ == '__main__':
    # Use port 5001 to avoid conflicts with macOS AirPlay Receiver on port 5000
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)

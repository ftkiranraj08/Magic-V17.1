#!/usr/bin/env python3
"""
Standalone Plot Generator for Genetic Circuit Simulation
========================================================

This script generates plots for genetic circuit simulations with configurable
component arrangements and parameters. It can be used independently of the 
main web application for testing and analysis.

Usage:
    python standalone_plot_generator.py
    
Or customize the circuit configuration in the main() function and run.
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import odeint
import json
from datetime import datetime
import os

# Default circuit parameters
DEFAULT_PARAMS = {
    # Global parameters
    'global_transcription_rate': 1.0,
    'global_translation_rate': 1.0,
    'global_degradation_rate': 1.0,
    'temperature_factor': 1.0,
    'resource_availability': 1.0,
    
    # Component-specific parameters
    'promoter_strength': 100.0,
    'rbs_efficiency': 1.0,
    'cds_translation_rate': 10.0,
    'cds_degradation_rate': 0.1,
    'terminator_efficiency': 0.95,
    
    # Regulatory parameters
    'repressor_strength': 2.0,
    'activator_strength': 3.0,
    'binding_affinity': 0.1,
    'cooperativity': 2.0,
    
    # Simulation parameters
    'simulation_time': 100,
    'time_points': 1000,
    'initial_conditions': [0.0, 0.0]  # [mRNA, Protein]
}

# Circuit component arrangements
CIRCUIT_ARRANGEMENTS = {
    'simple_operon': ['Promoter', 'RBS', 'CDS', 'Terminator'],
    'dual_gene': ['Promoter', 'RBS', 'CDS', 'RBS', 'CDS', 'Terminator'],
    'regulated_operon': ['Promoter', 'RBS', 'CDS', 'Repressor Start', 'Promoter', 'RBS', 'CDS', 'Terminator'],
    'activated_circuit': ['Promoter', 'RBS', 'CDS', 'Activator Start', 'Promoter', 'RBS', 'CDS', 'Terminator'],
    'toggle_switch': ['Promoter', 'RBS', 'CDS', 'Repressor Start', 'Promoter', 'RBS', 'CDS', 'Repressor End', 'Terminator'],
    'custom': []  # Will be defined by user
}

class GeneticCircuitSimulator:
    """Simplified genetic circuit simulator for standalone plotting."""
    
    def __init__(self, arrangement, parameters=None):
        """
        Initialize the simulator with a circuit arrangement and parameters.
        
        Args:
            arrangement (list): List of component names in order
            parameters (dict): Circuit parameters (uses defaults if None)
        """
        self.arrangement = arrangement
        self.params = DEFAULT_PARAMS.copy()
        if parameters:
            self.params.update(parameters)
        
        self.component_effects = self._calculate_component_effects()
    
    def _calculate_component_effects(self):
        """Calculate the cumulative effects of components in the circuit."""
        effects = {
            'transcription_rate': self.params['promoter_strength'] * self.params['global_transcription_rate'],
            'translation_rate': self.params['rbs_efficiency'] * self.params['cds_translation_rate'] * self.params['global_translation_rate'],
            'degradation_rate': self.params['cds_degradation_rate'] * self.params['global_degradation_rate'],
            'termination_efficiency': self.params.get('terminator_efficiency', 1.0)
        }
        
        # Apply environmental factors
        effects['transcription_rate'] *= self.params['temperature_factor'] * self.params['resource_availability']
        effects['translation_rate'] *= self.params['temperature_factor'] * self.params['resource_availability']
        
        # Apply regulatory effects
        if 'Repressor Start' in self.arrangement:
            repression_factor = 1 / (1 + (self.params['repressor_strength'] / self.params['binding_affinity']) ** self.params['cooperativity'])
            effects['transcription_rate'] *= repression_factor
        
        if 'Activator Start' in self.arrangement:
            activation_factor = 1 + (self.params['activator_strength'] / self.params['binding_affinity']) ** self.params['cooperativity']
            effects['transcription_rate'] *= activation_factor
        
        return effects
    
    def differential_equations(self, state, t):
        """
        Differential equations for the genetic circuit.
        
        Args:
            state (list): [mRNA_concentration, Protein_concentration]
            t (float): Time point
            
        Returns:
            list: [dmRNA/dt, dProtein/dt]
        """
        mRNA, protein = state
        
        # mRNA dynamics
        transcription = self.component_effects['transcription_rate']
        mRNA_degradation = self.component_effects['degradation_rate'] * mRNA
        dmRNA_dt = transcription - mRNA_degradation
        
        # Protein dynamics  
        translation = self.component_effects['translation_rate'] * mRNA
        protein_degradation = self.component_effects['degradation_rate'] * protein * 0.1  # Proteins degrade slower
        dProtein_dt = translation - protein_degradation
        
        return [dmRNA_dt, dProtein_dt]
    
    def simulate(self):
        """
        Run the simulation and return time points and concentrations.
        
        Returns:
            tuple: (time_array, mRNA_array, protein_array)
        """
        t = np.linspace(0, self.params['simulation_time'], self.params['time_points'])
        initial_state = self.params['initial_conditions']
        
        # Solve differential equations
        solution = odeint(self.differential_equations, initial_state, t)
        
        mRNA_concentrations = solution[:, 0]
        protein_concentrations = solution[:, 1]
        
        return t, mRNA_concentrations, protein_concentrations

def plot_circuit_dynamics(simulator, title=None, save_path=None, show_components=True):
    """
    Generate and display/save a plot of the circuit dynamics.
    
    Args:
        simulator (GeneticCircuitSimulator): The configured simulator
        title (str): Plot title (auto-generated if None)
        save_path (str): File path to save the plot (optional)
        show_components (bool): Whether to show component arrangement in title
        
    Returns:
        tuple: (figure, axes) matplotlib objects
    """
    # Run simulation
    t, mRNA, protein = simulator.simulate()
    
    # Create the plot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    # mRNA plot
    ax1.plot(t, mRNA, 'b-', linewidth=2, label='mRNA')
    ax1.set_ylabel('mRNA Concentration (AU)', fontsize=12)
    ax1.set_title('mRNA Dynamics', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    
    # Protein plot
    ax2.plot(t, protein, 'r-', linewidth=2, label='Protein')
    ax2.set_xlabel('Time (minutes)', fontsize=12)
    ax2.set_ylabel('Protein Concentration (AU)', fontsize=12)
    ax2.set_title('Protein Dynamics', fontsize=14, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.legend()
    
    # Overall title
    if title is None:
        if show_components:
            components_str = ' → '.join(simulator.arrangement)
            title = f'Genetic Circuit Simulation\nArrangement: {components_str}'
        else:
            title = 'Genetic Circuit Simulation Results'
    
    fig.suptitle(title, fontsize=16, fontweight='bold')
    
    # Add parameter information
    param_text = f"""Key Parameters:
Promoter Strength: {simulator.params['promoter_strength']:.1f}
RBS Efficiency: {simulator.params['rbs_efficiency']:.1f}
CDS Translation Rate: {simulator.params['cds_translation_rate']:.1f}
Degradation Rate: {simulator.params['cds_degradation_rate']:.1f}"""
    
    fig.text(0.02, 0.02, param_text, fontsize=9, verticalalignment='bottom',
             bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.8))
    
    plt.tight_layout()
    
    # Save if path provided
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Plot saved to: {save_path}")
    
    return fig, (ax1, ax2)

def compare_parameter_effects(base_arrangement, parameter_name, parameter_values, other_params=None):
    """
    Compare the effects of different parameter values on the same circuit.
    
    Args:
        base_arrangement (list): Base circuit arrangement
        parameter_name (str): Name of parameter to vary
        parameter_values (list): List of parameter values to test
        other_params (dict): Other parameters to override defaults
        
    Returns:
        matplotlib figure object
    """
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
    
    colors = plt.cm.viridis(np.linspace(0, 1, len(parameter_values)))
    
    for i, param_value in enumerate(parameter_values):
        # Setup parameters
        params = DEFAULT_PARAMS.copy()
        if other_params:
            params.update(other_params)
        params[parameter_name] = param_value
        
        # Run simulation
        simulator = GeneticCircuitSimulator(base_arrangement, params)
        t, mRNA, protein = simulator.simulate()
        
        # Plot results
        label = f'{parameter_name}={param_value}'
        ax1.plot(t, mRNA, color=colors[i], linewidth=2, label=label)
        ax2.plot(t, protein, color=colors[i], linewidth=2, label=label)
    
    # Format plots
    ax1.set_ylabel('mRNA Concentration (AU)', fontsize=12)
    ax1.set_title('mRNA Dynamics - Parameter Comparison', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    
    ax2.set_xlabel('Time (minutes)', fontsize=12)
    ax2.set_ylabel('Protein Concentration (AU)', fontsize=12)
    ax2.set_title('Protein Dynamics - Parameter Comparison', fontsize=14, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    ax2.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    
    arrangement_str = ' → '.join(base_arrangement)
    fig.suptitle(f'Parameter Analysis: {parameter_name}\nCircuit: {arrangement_str}', 
                 fontsize=16, fontweight='bold')
    
    plt.tight_layout()
    return fig

def generate_circuit_summary(arrangement, parameters=None):
    """
    Generate a text summary of the circuit configuration.
    
    Args:
        arrangement (list): Circuit component arrangement
        parameters (dict): Circuit parameters
        
    Returns:
        str: Formatted summary text
    """
    params = DEFAULT_PARAMS.copy()
    if parameters:
        params.update(parameters)
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    summary = f"""
Genetic Circuit Simulation Summary
=================================
Generated: {timestamp}

Circuit Arrangement:
{' → '.join(arrangement)}

Component Count:
- Total components: {len(arrangement)}
- Promoters: {arrangement.count('Promoter')}
- RBS: {arrangement.count('RBS')}
- CDS: {arrangement.count('CDS')}
- Terminators: {arrangement.count('Terminator')}
- Regulatory elements: {sum(arrangement.count(x) for x in ['Repressor Start', 'Repressor End', 'Activator Start', 'Activator End'])}

Key Parameters:
- Promoter Strength: {params['promoter_strength']}
- RBS Efficiency: {params['rbs_efficiency']}
- CDS Translation Rate: {params['cds_translation_rate']}
- Degradation Rate: {params['cds_degradation_rate']}
- Temperature Factor: {params['temperature_factor']}
- Resource Availability: {params['resource_availability']}

Regulatory Parameters:
- Repressor Strength: {params['repressor_strength']}
- Activator Strength: {params['activator_strength']}
- Binding Affinity: {params['binding_affinity']}
- Cooperativity: {params['cooperativity']}

Simulation Settings:
- Time Duration: {params['simulation_time']} minutes
- Time Points: {params['time_points']}
- Initial Conditions: {params['initial_conditions']}
"""
    return summary

def main():
    """
    Main function demonstrating various circuit configurations and analyses.
    """
    print("Genetic Circuit Plot Generator")
    print("=" * 50)
    
    # Example 1: Simple operon with default parameters
    print("\n1. Generating simple operon plot with default parameters...")
    simple_circuit = CIRCUIT_ARRANGEMENTS['simple_operon']
    simulator1 = GeneticCircuitSimulator(simple_circuit)
    fig1, axes1 = plot_circuit_dynamics(simulator1, save_path='simple_operon_default.png')
    plt.show()
    
    # Example 2: Custom parameters for enhanced expression
    print("\n2. Generating enhanced expression circuit...")
    enhanced_params = {
        'promoter_strength': 10.0,  # Strong promoter
        'rbs_efficiency': 2.0,      # Efficient RBS
        'cds_translation_rate': 15.0, # High translation
        'cds_degradation_rate': 0.5   # Low degradation
    }
    simulator2 = GeneticCircuitSimulator(simple_circuit, enhanced_params)
    fig2, axes2 = plot_circuit_dynamics(simulator2, 
                                       title="Enhanced Expression Circuit\nHigh Promoter + Efficient RBS + Low Degradation",
                                       save_path='enhanced_expression_circuit.png')
    plt.show()
    
    # Example 3: Regulated circuit with repression
    print("\n3. Generating regulated circuit with repression...")
    regulated_circuit = CIRCUIT_ARRANGEMENTS['regulated_operon']
    repression_params = {
        'promoter_strength': 8.0,
        'repressor_strength': 5.0,
        'binding_affinity': 0.05  # Strong binding
    }
    simulator3 = GeneticCircuitSimulator(regulated_circuit, repression_params)
    fig3, axes3 = plot_circuit_dynamics(simulator3, save_path='regulated_circuit.png')
    plt.show()
    
    # Example 4: Parameter comparison - Promoter strength effects
    print("\n4. Comparing different promoter strengths...")
    promoter_strengths = [1.0, 3.0, 5.0, 8.0, 12.0]
    fig4 = compare_parameter_effects(simple_circuit, 'promoter_strength', promoter_strengths)
    plt.savefig('promoter_strength_comparison.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    # Example 5: Parameter comparison - RBS efficiency effects
    print("\n5. Comparing different RBS efficiencies...")
    rbs_efficiencies = [0.5, 1.0, 1.5, 2.0, 3.0]
    fig5 = compare_parameter_effects(simple_circuit, 'rbs_efficiency', rbs_efficiencies)
    plt.savefig('rbs_efficiency_comparison.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    # Example 6: Custom arrangement - Toggle switch
    print("\n6. Generating toggle switch circuit...")
    toggle_params = {
        'promoter_strength': 6.0,
        'repressor_strength': 4.0,
        'binding_affinity': 0.1,
        'cooperativity': 3.0
    }
    simulator6 = GeneticCircuitSimulator(CIRCUIT_ARRANGEMENTS['toggle_switch'], toggle_params)
    fig6, axes6 = plot_circuit_dynamics(simulator6, save_path='toggle_switch_circuit.png')
    plt.show()
    
    # Generate and save circuit summaries
    print("\n7. Generating circuit summaries...")
    for name, arrangement in CIRCUIT_ARRANGEMENTS.items():
        if arrangement:  # Skip empty custom arrangement
            summary = generate_circuit_summary(arrangement)
            with open(f'{name}_summary.txt', 'w') as f:
                f.write(summary)
            print(f"Summary saved: {name}_summary.txt")
    
    print("\nAll plots and summaries generated successfully!")
    print("Check the current directory for output files.")

if __name__ == "__main__":
    main()
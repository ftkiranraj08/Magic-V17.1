#!/usr/bin/env python3
"""
Example Usage of Standalone Plot Generator
==========================================

This script demonstrates how to use the standalone plot generator
to create custom genetic circuit simulations with different arrangements
and parameters.

Run this file to see various examples of circuit designs and their outputs.
"""

from standalone_plot_generator import GeneticCircuitSimulator, plot_circuit_dynamics, compare_parameter_effects, CIRCUIT_ARRANGEMENTS
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server use
import matplotlib.pyplot as plt

def example_1_basic_operon():
    """Example 1: Basic operon with default parameters"""
    print("Example 1: Basic Operon (Promoter → RBS → CDS → Terminator)")
    
    # Define the circuit arrangement
    arrangement = ['Promoter', 'RBS', 'CDS', 'Terminator']
    
    # Use default parameters
    simulator = GeneticCircuitSimulator(arrangement)
    
    # Generate and save plot
    fig, axes = plot_circuit_dynamics(
        simulator, 
        title="Basic Operon - Default Parameters",
        save_path="example1_basic_operon.png"
    )
    plt.close(fig)
    print("✓ Saved: example1_basic_operon.png")
    return simulator

def example_2_high_expression():
    """Example 2: High expression system"""
    print("\nExample 2: High Expression System")
    
    arrangement = ['Promoter', 'RBS', 'CDS', 'Terminator']
    
    # Custom parameters for high expression
    custom_params = {
        'promoter_strength': 15.0,      # Very strong promoter
        'rbs_efficiency': 3.0,          # Very efficient RBS
        'cds_translation_rate': 20.0,   # High translation rate
        'cds_degradation_rate': 0.3,    # Low degradation (stable protein)
        'terminator_efficiency': 0.99   # Highly efficient terminator
    }
    
    simulator = GeneticCircuitSimulator(arrangement, custom_params)
    fig, axes = plot_circuit_dynamics(
        simulator,
        title="High Expression System\nStrong Promoter + Efficient RBS + Low Degradation",
        save_path="example2_high_expression.png"
    )
    plt.close(fig)
    print("✓ Saved: example2_high_expression.png")
    return simulator

def example_3_repressed_system():
    """Example 3: Repressed gene expression system"""
    print("\nExample 3: Repressed Expression System")
    
    # Circuit with repression
    arrangement = ['Promoter', 'RBS', 'CDS', 'Repressor Start', 'Promoter', 'RBS', 'CDS', 'Terminator']
    
    # Parameters with repression
    repression_params = {
        'promoter_strength': 8.0,
        'rbs_efficiency': 1.5,
        'cds_translation_rate': 10.0,
        'repressor_strength': 6.0,      # Strong repression
        'binding_affinity': 0.02,       # Strong binding
        'cooperativity': 3.0            # Cooperative binding
    }
    
    simulator = GeneticCircuitSimulator(arrangement, repression_params)
    fig, axes = plot_circuit_dynamics(
        simulator,
        title="Repressed Expression System\nStrong Repressor with Cooperative Binding",
        save_path="example3_repressed_system.png"
    )
    plt.close(fig)
    print("✓ Saved: example3_repressed_system.png")
    return simulator

def example_4_dual_gene():
    """Example 4: Dual gene operon"""
    print("\nExample 4: Dual Gene Operon")
    
    # Two genes in one operon
    arrangement = ['Promoter', 'RBS', 'CDS', 'RBS', 'CDS', 'Terminator']
    
    dual_gene_params = {
        'promoter_strength': 6.0,
        'rbs_efficiency': 1.2,
        'cds_translation_rate': 8.0,
        'cds_degradation_rate': 0.8
    }
    
    simulator = GeneticCircuitSimulator(arrangement, dual_gene_params)
    fig, axes = plot_circuit_dynamics(
        simulator,
        title="Dual Gene Operon\nTwo Proteins from One Promoter",
        save_path="example4_dual_gene.png"
    )
    plt.close(fig)
    print("✓ Saved: example4_dual_gene.png")
    return simulator

def example_5_environmental_effects():
    """Example 5: Environmental condition effects"""
    print("\nExample 5: Environmental Condition Effects")
    
    arrangement = ['Promoter', 'RBS', 'CDS', 'Terminator']
    
    # Standard conditions
    standard_params = {
        'promoter_strength': 5.0,
        'temperature_factor': 1.0,
        'resource_availability': 1.0
    }
    
    # Stress conditions (high temperature, low resources)
    stress_params = {
        'promoter_strength': 5.0,
        'temperature_factor': 1.4,      # High temperature increases rates
        'resource_availability': 0.6,   # Limited resources
        'global_degradation_rate': 1.5  # Increased degradation
    }
    
    # Create both simulations
    sim_standard = GeneticCircuitSimulator(arrangement, standard_params)
    sim_stress = GeneticCircuitSimulator(arrangement, stress_params)
    
    # Plot comparison
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
    
    # Standard conditions
    t1, mRNA1, protein1 = sim_standard.simulate()
    ax1.plot(t1, protein1, 'b-', linewidth=2, label='Standard Conditions')
    ax1.set_ylabel('Protein Concentration', fontsize=12)
    ax1.set_title('Standard vs Stress Conditions', fontsize=14, fontweight='bold')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Stress conditions  
    t2, mRNA2, protein2 = sim_stress.simulate()
    ax2.plot(t2, protein2, 'r-', linewidth=2, label='Stress Conditions')
    ax2.set_xlabel('Time (minutes)', fontsize=12)
    ax2.set_ylabel('Protein Concentration', fontsize=12)
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('example5_environmental_effects.png', dpi=300, bbox_inches='tight')
    plt.close(fig)
    print("✓ Saved: example5_environmental_effects.png")

def example_6_parameter_sweep():
    """Example 6: Parameter sweep analysis"""
    print("\nExample 6: Parameter Sweep Analysis")
    
    arrangement = ['Promoter', 'RBS', 'CDS', 'Terminator']
    
    # Test different RBS efficiencies
    rbs_values = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
    
    fig = compare_parameter_effects(
        arrangement, 
        'rbs_efficiency', 
        rbs_values,
        other_params={'promoter_strength': 6.0}  # Keep promoter constant
    )
    
    plt.savefig('example6_rbs_sweep.png', dpi=300, bbox_inches='tight')
    plt.close(fig)
    print("✓ Saved: example6_rbs_sweep.png")
    
    # Test different promoter strengths
    promoter_values = [2.0, 5.0, 8.0, 12.0, 16.0]
    
    fig = compare_parameter_effects(
        arrangement,
        'promoter_strength',
        promoter_values,
        other_params={'rbs_efficiency': 1.5}  # Keep RBS constant
    )
    
    plt.savefig('example6_promoter_sweep.png', dpi=300, bbox_inches='tight')
    plt.close(fig)
    print("✓ Saved: example6_promoter_sweep.png")

def main():
    """Run all examples"""
    print("Genetic Circuit Design Examples")
    print("=" * 50)
    
    # Run examples
    sim1 = example_1_basic_operon()
    sim2 = example_2_high_expression()
    sim3 = example_3_repressed_system()
    sim4 = example_4_dual_gene()
    example_5_environmental_effects()
    example_6_parameter_sweep()
    
    # Summary
    print("\n" + "=" * 50)
    print("All examples completed successfully!")
    print("\nGenerated files:")
    print("- example1_basic_operon.png")
    print("- example2_high_expression.png") 
    print("- example3_repressed_system.png")
    print("- example4_dual_gene.png")
    print("- example5_environmental_effects.png")
    print("- example6_rbs_sweep.png")
    print("- example6_promoter_sweep.png")
    
    print("\nTo customize your own circuits:")
    print("1. Edit circuit_configs.json for predefined configurations")
    print("2. Use quick_plot_generator.py for interactive design")
    print("3. Import standalone_plot_generator in your own scripts")
    
    print("\nKey parameters you can modify:")
    print("- promoter_strength: Controls transcription rate (1.0 - 20.0)")
    print("- rbs_efficiency: Controls translation efficiency (0.1 - 5.0)")
    print("- cds_translation_rate: Protein production rate (1.0 - 25.0)")
    print("- cds_degradation_rate: Protein/mRNA decay rate (0.1 - 3.0)")
    print("- repressor_strength: Strength of repression (1.0 - 10.0)")
    print("- activator_strength: Strength of activation (1.0 - 10.0)")
    print("- binding_affinity: Regulatory binding strength (0.01 - 1.0)")
    print("- cooperativity: Cooperative binding effect (1.0 - 4.0)")

if __name__ == "__main__":
    main()
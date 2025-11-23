#!/usr/bin/env python3
"""
Quick Circuit Plot Generator
===========================

A simplified version of the standalone plot generator that uses configuration
files for easy parameter modification. This is ideal for quick testing and
parameter exploration.

Usage:
    python quick_plot_generator.py
    
Modify circuit_configs.json to change circuit arrangements and parameters.
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from standalone_plot_generator import GeneticCircuitSimulator, plot_circuit_dynamics, compare_parameter_effects

def load_configuration(config_file='circuit_configs.json'):
    """Load circuit configurations from JSON file."""
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Configuration file {config_file} not found!")
        print("Using default simple operon configuration.")
        return {
            "circuit_configurations": {
                "simple_operon": {
                    "arrangement": ["Promoter", "RBS", "CDS", "Terminator"],
                    "parameters": {
                        "promoter_strength": 5.0,
                        "rbs_efficiency": 1.0,
                        "cds_translation_rate": 7.0,
                        "cds_degradation_rate": 1.0
                    }
                }
            },
            "environmental_conditions": {"standard": {}},
            "simulation_settings": {"standard": {"simulation_time": 100, "time_points": 1000}}
        }

def create_custom_circuit():
    """Interactive function to create a custom circuit arrangement."""
    print("\n=== Custom Circuit Builder ===")
    print("Available components:")
    components = ["Promoter", "RBS", "CDS", "Terminator", "Repressor Start", "Repressor End", "Activator Start", "Activator End"]
    for i, comp in enumerate(components, 1):
        print(f"{i}. {comp}")
    
    arrangement = []
    print("\nBuild your circuit (enter component numbers, 0 to finish):")
    
    while True:
        try:
            choice = input(f"Add component {len(arrangement)+1} (1-{len(components)}, 0 to finish): ").strip()
            if choice == '0':
                break
            choice_idx = int(choice) - 1
            if 0 <= choice_idx < len(components):
                arrangement.append(components[choice_idx])
                print(f"Added: {components[choice_idx]}")
                print(f"Current arrangement: {' → '.join(arrangement)}")
            else:
                print("Invalid choice. Please try again.")
        except ValueError:
            print("Please enter a valid number.")
    
    if not arrangement:
        print("No components added. Using simple operon.")
        arrangement = ["Promoter", "RBS", "CDS", "Terminator"]
    
    return arrangement

def modify_parameters_interactively(base_params):
    """Interactive function to modify circuit parameters."""
    print("\n=== Parameter Modification ===")
    print("Current parameters:")
    for key, value in base_params.items():
        print(f"  {key}: {value}")
    
    print("\nEnter new values (press Enter to keep current value):")
    modified_params = base_params.copy()
    
    for key, current_value in base_params.items():
        try:
            user_input = input(f"{key} [{current_value}]: ").strip()
            if user_input:
                modified_params[key] = float(user_input)
        except ValueError:
            print(f"Invalid value for {key}, keeping current value.")
    
    return modified_params

def run_interactive_session():
    """Run an interactive session for circuit design and parameter exploration."""
    print("Genetic Circuit Interactive Plot Generator")
    print("=" * 50)
    
    # Load configurations
    config = load_configuration()
    
    while True:
        print("\nOptions:")
        print("1. Use predefined circuit configuration")
        print("2. Create custom circuit arrangement")
        print("3. Compare parameter effects")
        print("4. Exit")
        
        choice = input("Select option (1-4): ").strip()
        
        if choice == '1':
            # Show available configurations
            print("\nAvailable circuit configurations:")
            circuits = list(config['circuit_configurations'].keys())
            for i, circuit_name in enumerate(circuits, 1):
                print(f"{i}. {circuit_name}")
            
            try:
                circuit_idx = int(input("Select circuit (number): ")) - 1
                if 0 <= circuit_idx < len(circuits):
                    circuit_name = circuits[circuit_idx]
                    circuit_config = config['circuit_configurations'][circuit_name]
                    
                    # Show environmental conditions
                    print("\nAvailable environmental conditions:")
                    conditions = list(config['environmental_conditions'].keys())
                    for i, condition in enumerate(conditions, 1):
                        print(f"{i}. {condition}")
                    
                    condition_idx = int(input("Select environment (number): ")) - 1
                    if 0 <= condition_idx < len(conditions):
                        condition_name = conditions[condition_idx]
                        env_config = config['environmental_conditions'][condition_name]
                        
                        # Combine parameters
                        all_params = {}
                        all_params.update(circuit_config['parameters'])
                        all_params.update(env_config)
                        all_params.update(config['simulation_settings']['standard'])
                        
                        # Ask if user wants to modify parameters
                        modify = input("Modify parameters? (y/n): ").strip().lower()
                        if modify == 'y':
                            all_params = modify_parameters_interactively(all_params)
                        
                        # Run simulation
                        simulator = GeneticCircuitSimulator(circuit_config['arrangement'], all_params)
                        title = f"{circuit_name} - {condition_name} conditions"
                        fig, axes = plot_circuit_dynamics(simulator, title=title)
                        plt.show()
                        
                        # Ask to save
                        save = input("Save plot? (y/n): ").strip().lower()
                        if save == 'y':
                            filename = f"{circuit_name}_{condition_name}_plot.png"
                            fig.savefig(filename, dpi=300, bbox_inches='tight')
                            print(f"Plot saved as {filename}")
            
            except (ValueError, IndexError):
                print("Invalid selection.")
        
        elif choice == '2':
            # Custom circuit
            arrangement = create_custom_circuit()
            base_params = config['circuit_configurations']['simple_operon']['parameters'].copy()
            base_params.update(config['simulation_settings']['standard'])
            
            # Modify parameters
            modify = input("Modify parameters? (y/n): ").strip().lower()
            if modify == 'y':
                base_params = modify_parameters_interactively(base_params)
            
            # Run simulation
            simulator = GeneticCircuitSimulator(arrangement, base_params)
            title = f"Custom Circuit\n{' → '.join(arrangement)}"
            fig, axes = plot_circuit_dynamics(simulator, title=title)
            plt.show()
            
            # Ask to save
            save = input("Save plot? (y/n): ").strip().lower()
            if save == 'y':
                filename = input("Enter filename (without extension): ").strip() + ".png"
                fig.savefig(filename, dpi=300, bbox_inches='tight')
                print(f"Plot saved as {filename}")
        
        elif choice == '3':
            # Parameter comparison
            circuits = list(config['circuit_configurations'].keys())
            print("\nSelect base circuit for parameter comparison:")
            for i, circuit_name in enumerate(circuits, 1):
                print(f"{i}. {circuit_name}")
            
            try:
                circuit_idx = int(input("Select circuit (number): ")) - 1
                if 0 <= circuit_idx < len(circuits):
                    circuit_name = circuits[circuit_idx]
                    circuit_config = config['circuit_configurations'][circuit_name]
                    
                    print("\nAvailable parameters to compare:")
                    params = list(circuit_config['parameters'].keys())
                    for i, param in enumerate(params, 1):
                        print(f"{i}. {param}")
                    
                    param_idx = int(input("Select parameter to vary (number): ")) - 1
                    if 0 <= param_idx < len(params):
                        param_name = params[param_idx]
                        
                        print(f"\nEnter values for {param_name} (comma-separated):")
                        values_input = input("Values: ").strip()
                        param_values = [float(v.strip()) for v in values_input.split(',')]
                        
                        # Generate comparison plot
                        fig = compare_parameter_effects(circuit_config['arrangement'], param_name, param_values)
                        plt.show()
                        
                        # Ask to save
                        save = input("Save comparison plot? (y/n): ").strip().lower()
                        if save == 'y':
                            filename = f"{circuit_name}_{param_name}_comparison.png"
                            fig.savefig(filename, dpi=300, bbox_inches='tight')
                            print(f"Comparison plot saved as {filename}")
            
            except (ValueError, IndexError):
                print("Invalid selection.")
        
        elif choice == '4':
            print("Goodbye!")
            break
        
        else:
            print("Invalid choice. Please select 1-4.")

def quick_plot_from_config(circuit_name=None, environment='standard', modify_params=False):
    """
    Generate a plot quickly using configuration file.
    
    Args:
        circuit_name (str): Name of circuit configuration to use
        environment (str): Environmental condition to apply
        modify_params (bool): Whether to allow parameter modification
    """
    config = load_configuration()
    
    # Use first available circuit if none specified
    if circuit_name is None:
        circuit_name = list(config['circuit_configurations'].keys())[0]
    
    if circuit_name not in config['circuit_configurations']:
        print(f"Circuit '{circuit_name}' not found in configuration.")
        return None
    
    circuit_config = config['circuit_configurations'][circuit_name]
    env_config = config['environmental_conditions'].get(environment, {})
    sim_config = config['simulation_settings']['standard']
    
    # Combine parameters
    all_params = {}
    all_params.update(circuit_config['parameters'])
    all_params.update(env_config)
    all_params.update(sim_config)
    
    if modify_params:
        all_params = modify_parameters_interactively(all_params)
    
    # Create and run simulation
    simulator = GeneticCircuitSimulator(circuit_config['arrangement'], all_params)
    title = f"{circuit_name} ({environment} conditions)"
    fig, axes = plot_circuit_dynamics(simulator, title=title)
    
    return fig, simulator

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Command line usage
        circuit_name = sys.argv[1] if len(sys.argv) > 1 else None
        environment = sys.argv[2] if len(sys.argv) > 2 else 'standard'
        
        fig, sim = quick_plot_from_config(circuit_name, environment)
        if fig:
            plt.show()
            
            # Save automatically
            filename = f"{circuit_name}_{environment}_quick_plot.png"
            fig.savefig(filename, dpi=300, bbox_inches='tight')
            print(f"Plot saved as {filename}")
    else:
        # Interactive mode
        run_interactive_session()
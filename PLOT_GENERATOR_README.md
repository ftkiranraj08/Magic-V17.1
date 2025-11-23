# Genetic Circuit Plot Generator

A standalone plotting system for genetic circuit simulation with configurable component arrangements and parameters.

## Files Overview

### Core Files
- **`standalone_plot_generator.py`** - Main simulation engine with comprehensive plotting functions
- **`circuit_configs.json`** - Configuration file with predefined circuit arrangements and parameters
- **`quick_plot_generator.py`** - Interactive interface for quick plot generation
- **`examples_plot_generator.py`** - Example usage demonstrating various circuit designs

### Test Files
- **`test_plot_generator.py`** - Non-interactive testing script

## Quick Start

### 1. Basic Usage
```bash
# Run examples to see different circuit types
python3 examples_plot_generator.py

# Interactive mode for custom circuits
python3 quick_plot_generator.py

# Command line usage for specific circuits
python3 quick_plot_generator.py simple_operon standard
```

### 2. Customizing Parameters

Edit `circuit_configs.json` to modify:
- Circuit component arrangements
- Parameter values for each component
- Environmental conditions
- Simulation settings

### 3. Available Circuit Types

#### Predefined Arrangements:
- **`simple_operon`**: Promoter → RBS → CDS → Terminator
- **`dual_gene_operon`**: Promoter → RBS → CDS → RBS → CDS → Terminator  
- **`repressed_circuit`**: With repressor regulation
- **`activated_circuit`**: With activator regulation
- **`toggle_switch`**: Bistable regulatory circuit
- **`enhanced_expression`**: Optimized for high protein production

#### Custom Arrangements:
Build your own using components:
- `Promoter` - Initiates transcription
- `RBS` - Ribosome binding site for translation
- `CDS` - Coding sequence (gene)
- `Terminator` - Stops transcription
- `Repressor Start/End` - Negative regulation
- `Activator Start/End` - Positive regulation

## Key Parameters

### Component Parameters
- **`promoter_strength`** (1.0 - 20.0): Transcription initiation rate
- **`rbs_efficiency`** (0.1 - 5.0): Translation efficiency
- **`cds_translation_rate`** (1.0 - 25.0): Protein production rate
- **`cds_degradation_rate`** (0.1 - 3.0): Protein/mRNA decay rate
- **`terminator_efficiency`** (0.5 - 1.0): Transcription termination efficiency

### Regulatory Parameters
- **`repressor_strength`** (1.0 - 10.0): Strength of negative regulation
- **`activator_strength`** (1.0 - 10.0): Strength of positive regulation
- **`binding_affinity`** (0.01 - 1.0): Regulatory protein binding strength
- **`cooperativity`** (1.0 - 4.0): Cooperative binding effects

### Environmental Parameters
- **`temperature_factor`** (0.5 - 2.0): Temperature effect on reaction rates
- **`resource_availability`** (0.1 - 2.0): Nutrient/resource limitation
- **`global_transcription_rate`** (0.1 - 3.0): Overall transcription multiplier
- **`global_translation_rate`** (0.1 - 3.0): Overall translation multiplier
- **`global_degradation_rate`** (0.1 - 3.0): Overall degradation multiplier

### Simulation Parameters
- **`simulation_time`** (10 - 1000): Duration in minutes
- **`time_points`** (100 - 10000): Resolution of simulation
- **`initial_conditions`** [mRNA, Protein]: Starting concentrations

## Usage Examples

### Example 1: High Expression System
```python
from standalone_plot_generator import GeneticCircuitSimulator, plot_circuit_dynamics

# Define high-expression parameters
params = {
    'promoter_strength': 15.0,
    'rbs_efficiency': 3.0, 
    'cds_translation_rate': 20.0,
    'cds_degradation_rate': 0.3
}

# Create and simulate
arrangement = ['Promoter', 'RBS', 'CDS', 'Terminator']
simulator = GeneticCircuitSimulator(arrangement, params)
fig, axes = plot_circuit_dynamics(simulator, save_path='high_expression.png')
```

### Example 2: Parameter Comparison
```python
from standalone_plot_generator import compare_parameter_effects

# Compare different promoter strengths
arrangement = ['Promoter', 'RBS', 'CDS', 'Terminator']
strengths = [2.0, 5.0, 8.0, 12.0, 16.0]
fig = compare_parameter_effects(arrangement, 'promoter_strength', strengths)
```

### Example 3: Environmental Conditions
```python
# Stress conditions
stress_params = {
    'promoter_strength': 5.0,
    'temperature_factor': 1.4,        # High temperature
    'resource_availability': 0.6,     # Limited resources
    'global_degradation_rate': 1.5    # Increased degradation
}
```

## Interactive Mode Features

The `quick_plot_generator.py` provides:

1. **Predefined Circuit Selection**: Choose from configured circuits
2. **Custom Circuit Builder**: Interactive component selection
3. **Parameter Modification**: Real-time parameter adjustment
4. **Environmental Conditions**: Apply different growth conditions
5. **Parameter Comparison**: Side-by-side parameter effect analysis
6. **Auto-save**: Automatic plot saving with descriptive names

## Configuration File Structure

```json
{
  "circuit_configurations": {
    "circuit_name": {
      "arrangement": ["Promoter", "RBS", "CDS", "Terminator"],
      "parameters": {
        "promoter_strength": 5.0,
        "rbs_efficiency": 1.0,
        "cds_translation_rate": 7.0
      }
    }
  },
  "environmental_conditions": {
    "condition_name": {
      "temperature_factor": 1.0,
      "resource_availability": 1.0
    }
  },
  "simulation_settings": {
    "setting_name": {
      "simulation_time": 100,
      "time_points": 1000
    }
  }
}
```

## Output Files

### Plot Files (.png)
- High-resolution plots (300 DPI)
- Dual panel: mRNA and Protein dynamics
- Parameter information overlay
- Professional formatting for publications

### Summary Files (.txt)
- Circuit arrangement description
- Complete parameter listing
- Component counts and analysis
- Timestamp and configuration details

## Advanced Usage

### Custom Simulation Class
```python
from standalone_plot_generator import GeneticCircuitSimulator

class CustomSimulator(GeneticCircuitSimulator):
    def differential_equations(self, state, t):
        # Override with custom equations
        # Add noise, delays, or other effects
        return super().differential_equations(state, t)
```

### Batch Processing
```python
# Process multiple configurations
configs = ['simple_operon', 'dual_gene', 'repressed_circuit']
conditions = ['standard', 'high_temperature', 'low_resources']

for config in configs:
    for condition in conditions:
        fig, sim = quick_plot_from_config(config, condition)
        filename = f"{config}_{condition}.png"
        fig.savefig(filename)
        plt.close(fig)
```

## Tips and Best Practices

1. **Parameter Ranges**: Stay within suggested ranges for realistic behavior
2. **Circuit Design**: Follow biological principles (Promoter before RBS before CDS)
3. **Regulation**: Use appropriate regulatory component pairs (Start/End)
4. **Performance**: Close figures after saving to prevent memory issues
5. **Comparison**: Use consistent simulation settings when comparing circuits
6. **Validation**: Check parameter effects make biological sense

## Troubleshooting

### Common Issues:
- **Import errors**: Ensure all dependencies installed (`matplotlib`, `scipy`, `numpy`)
- **Display issues**: Use non-interactive backend for server environments
- **Memory issues**: Close figures after use with `plt.close(fig)`
- **Parameter errors**: Check ranges in configuration file

### Dependencies:
```bash
pip install matplotlib scipy numpy
```

## Integration with Main Application

These tools work independently but can integrate with the main genetic circuit application:
- Use same parameter definitions for consistency
- Export configurations to/from main application
- Batch test parameter changes before applying to hardware
- Validate circuit designs before physical implementation
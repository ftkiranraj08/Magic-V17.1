#!/usr/bin/env python3
"""
Test the standalone plot generator without interactive display
"""

from standalone_plot_generator import *
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

# Test 1: Simple operon
print("Testing simple operon...")
simple_circuit = CIRCUIT_ARRANGEMENTS['simple_operon']
simulator1 = GeneticCircuitSimulator(simple_circuit)
fig1, axes1 = plot_circuit_dynamics(simulator1, save_path='test_simple_operon.png')
plt.close(fig1)  # Close to free memory
print("✓ Simple operon plot saved as test_simple_operon.png")

# Test 2: Enhanced parameters
print("\nTesting enhanced expression circuit...")
enhanced_params = {
    'promoter_strength': 10.0,
    'rbs_efficiency': 2.0,
    'cds_translation_rate': 15.0,
    'cds_degradation_rate': 0.5
}
simulator2 = GeneticCircuitSimulator(simple_circuit, enhanced_params)
fig2, axes2 = plot_circuit_dynamics(simulator2, 
                                   title="Enhanced Expression Circuit",
                                   save_path='test_enhanced_circuit.png')
plt.close(fig2)
print("✓ Enhanced expression plot saved as test_enhanced_circuit.png")

# Test 3: Regulated circuit
print("\nTesting regulated circuit...")
regulated_circuit = CIRCUIT_ARRANGEMENTS['regulated_operon']
repression_params = {
    'promoter_strength': 8.0,
    'repressor_strength': 5.0,
    'binding_affinity': 0.05
}
simulator3 = GeneticCircuitSimulator(regulated_circuit, repression_params)
fig3, axes3 = plot_circuit_dynamics(simulator3, save_path='test_regulated_circuit.png')
plt.close(fig3)
print("✓ Regulated circuit plot saved as test_regulated_circuit.png")

# Test 4: Parameter comparison
print("\nTesting parameter comparison...")
promoter_strengths = [1.0, 3.0, 5.0, 8.0, 12.0]
fig4 = compare_parameter_effects(simple_circuit, 'promoter_strength', promoter_strengths)
plt.savefig('test_promoter_comparison.png', dpi=300, bbox_inches='tight')
plt.close(fig4)
print("✓ Promoter strength comparison saved as test_promoter_comparison.png")

# Test 5: Circuit summary
print("\nGenerating circuit summary...")
summary = generate_circuit_summary(simple_circuit)
with open('test_circuit_summary.txt', 'w') as f:
    f.write(summary)
print("✓ Circuit summary saved as test_circuit_summary.txt")

print("\n" + "="*50)
print("All tests completed successfully!")
print("Generated files:")
print("- test_simple_operon.png")
print("- test_enhanced_circuit.png")
print("- test_regulated_circuit.png")
print("- test_promoter_comparison.png")
print("- test_circuit_summary.txt")
print("\nYou can now modify parameters in circuit_configs.json")
print("and use quick_plot_generator.py for interactive plotting.")
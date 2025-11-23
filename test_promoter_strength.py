#!/usr/bin/env python3
"""
Test script to generate a plot showing Promoter → RBS → CDS circuit 
with promoter strength = 3.0 vs default strength = 1.0
"""

import requests
import json
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle
import base64
from io import BytesIO

# Test data: Promoter → RBS → CDS circuit
test_circuit = {
    "cellboard": {
        "Promoter": [{"x": "0", "y": "0", "type": "Promoter", "strength": "norm"}],
        "RBS": [{"x": "1", "y": "0", "type": "RBS", "strength": "norm"}], 
        "CDS": [{"x": "2", "y": "0", "type": "CDS", "strength": "norm"}]
    },
    "apply_dial": True
}

def test_simulation(promoter_strength=1.0, description="Default"):
    """Run simulation with given promoter strength"""
    dial_params = {
        "promoter1_strength": promoter_strength,
        "global_transcription_rate": 1.0,  # Keep global at 1.0 to see individual effect
        "global_translation_rate": 1.0,
        "global_degradation_rate": 1.0
    }
    
    data = test_circuit.copy()
    data["dial"] = dial_params
    
    try:
        print(f"\n=== Testing {description} (Promoter Strength = {promoter_strength}) ===")
        response = requests.post(
            'http://127.0.0.1:5001/simulate',
            headers={'Content-Type': 'application/json'},
            json=data,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('status') == 'success':
                print(f"✅ Simulation successful for {description}")
                return result
            else:
                print(f"❌ Simulation failed: {result.get('message', 'Unknown error')}")
                return None
        else:
            print(f"❌ HTTP Error {response.status_code}: {response.text[:200]}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        return None

def create_comparison_plot():
    """Create a comparison plot showing different promoter strengths"""
    
    # Test different promoter strengths
    strengths = [1.0, 2.0, 3.0, 5.0]
    results = []
    
    print("Testing different promoter strengths...")
    
    for strength in strengths:
        result = test_simulation(strength, f"Strength {strength}")
        results.append((strength, result))
    
    # Create comparison plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
    
    # Plot 1: Circuit diagram
    ax1.set_xlim(0, 4)
    ax1.set_ylim(0, 2)
    ax1.set_aspect('equal')
    
    # Draw circuit components
    promoter = Rectangle((0.2, 0.8), 0.6, 0.4, facecolor='lightgreen', edgecolor='black', linewidth=2)
    rbs = Rectangle((1.2, 0.8), 0.6, 0.4, facecolor='lightblue', edgecolor='black', linewidth=2)
    cds = Rectangle((2.2, 0.8), 0.6, 0.4, facecolor='lightcoral', edgecolor='black', linewidth=2)
    
    ax1.add_patch(promoter)
    ax1.add_patch(rbs)
    ax1.add_patch(cds)
    
    # Labels
    ax1.text(0.5, 1.0, 'Promoter', ha='center', va='center', fontweight='bold')
    ax1.text(1.5, 1.0, 'RBS', ha='center', va='center', fontweight='bold')
    ax1.text(2.5, 1.0, 'CDS', ha='center', va='center', fontweight='bold')
    
    # Arrows
    ax1.arrow(0.85, 1.0, 0.25, 0, head_width=0.05, head_length=0.05, fc='black', ec='black')
    ax1.arrow(1.85, 1.0, 0.25, 0, head_width=0.05, head_length=0.05, fc='black', ec='black')
    
    ax1.set_title('Circuit: Promoter → RBS → CDS', fontsize=14, fontweight='bold')
    ax1.text(1.5, 0.3, 'Testing Promoter Strength Effect', ha='center', fontsize=12)
    ax1.axis('off')
    
    # Plot 2: Expected protein expression levels
    ax2.bar(range(len(strengths)), 
           [s * 5.0 for s in strengths],  # Approximate relative expression (strength × baseline)
           color=['lightgreen', 'green', 'darkgreen', 'forestgreen'],
           alpha=0.7,
           edgecolor='black',
           linewidth=1)
    
    ax2.set_xlabel('Promoter Strength', fontsize=12)
    ax2.set_ylabel('Relative Protein Expression', fontsize=12)
    ax2.set_title('Expected Protein Expression vs Promoter Strength', fontsize=14, fontweight='bold')
    ax2.set_xticks(range(len(strengths)))
    ax2.set_xticklabels([f'{s}' for s in strengths])
    ax2.grid(True, alpha=0.3)
    
    # Add value labels on bars
    for i, strength in enumerate(strengths):
        expected_expression = strength * 5.0
        ax2.text(i, expected_expression + 0.5, f'{expected_expression:.1f}', 
                ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    
    # Save the plot
    plot_path = '/Users/kiran/Desktop/version17.1_modified/promoter_strength_analysis.png'
    plt.savefig(plot_path, dpi=300, bbox_inches='tight')
    plt.show()
    
    print(f"\n📊 Comparison plot saved to: {plot_path}")
    
    # Display simulation results if available
    print("\n=== Simulation Results Summary ===")
    for strength, result in results:
        if result and result.get('status') == 'success':
            print(f"Promoter Strength {strength}: ✅ Simulation successful")
            if 'time_series' in result and result['time_series']:
                # Get final protein concentration (last time point)
                proteins = [k for k in result['time_series'].keys() if k != 'time']
                if proteins:
                    final_conc = result['time_series'][proteins[0]][-1] if result['time_series'][proteins[0]] else 0
                    print(f"  → Final protein concentration: {final_conc:.3f}")
        else:
            print(f"Promoter Strength {strength}: ❌ Simulation failed")
    
    return results

if __name__ == "__main__":
    print("🧬 Promoter Strength Analysis Test")
    print("Testing Promoter → RBS → CDS circuit with different promoter strengths")
    
    # Check if server is running
    try:
        response = requests.get('http://127.0.0.1:5001/', timeout=5)
        print("✅ Server is running")
    except:
        print("❌ Server is not running. Please start the Flask app first:")
        print("   cd /Users/kiran/Desktop/version17.1_modified && python3.13 app.py")
        exit(1)
    
    # Run the comparison test
    results = create_comparison_plot()
    
    print("\n🎯 Key Findings:")
    print("• Higher promoter strength should lead to higher protein expression")
    print("• Promoter strength = 3 should give ~3x higher expression than strength = 1")
    print("• The relationship should be approximately linear (if no saturation)")
    print("• Check the generated plot for visual comparison")
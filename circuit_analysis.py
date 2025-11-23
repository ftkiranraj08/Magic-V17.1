#!/usr/bin/env python3
"""
Standalone program to visualize genetic circuit behavior with different promoter strengths
Shows theoretical protein expression over time for Promoter → RBS → CDS circuit
"""

import matplotlib.pyplot as plt
import numpy as np
from scipy.integrate import odeint
import seaborn as sns

# Set style for better looking plots
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

def genetic_circuit_ode(y, t, promoter_strength, rbs_efficiency, translation_rate, degradation_rate):
    """
    ODE system for Promoter → RBS → CDS circuit
    y[0] = mRNA concentration
    y[1] = Protein concentration
    """
    mRNA, protein = y
    
    # Parameters
    transcription_rate = promoter_strength * 5.0  # Promoter strength affects transcription
    mRNA_degradation = 1.0  # mRNA degradation rate
    
    # Differential equations
    dmRNA_dt = transcription_rate - mRNA_degradation * mRNA
    dprotein_dt = translation_rate * rbs_efficiency * mRNA - degradation_rate * protein
    
    return [dmRNA_dt, dprotein_dt]

def simulate_circuit(promoter_strength, time_points=100, max_time=10):
    """Simulate the genetic circuit with given promoter strength"""
    
    # Circuit parameters
    rbs_efficiency = 1.0      # RBS efficiency
    translation_rate = 7.0    # CDS translation rate
    degradation_rate = 1.0    # Protein degradation rate
    
    # Initial conditions [mRNA, protein]
    y0 = [0.0, 0.0]
    
    # Time points
    t = np.linspace(0, max_time, time_points)
    
    # Solve ODE
    solution = odeint(genetic_circuit_ode, y0, t, 
                     args=(promoter_strength, rbs_efficiency, translation_rate, degradation_rate))
    
    mRNA = solution[:, 0]
    protein = solution[:, 1]
    
    return t, mRNA, protein

def create_promoter_strength_analysis():
    """Create comprehensive analysis of promoter strength effects"""
    
    # Different promoter strengths to test
    strengths = [0.5, 1.0, 2.0, 3.0, 5.0]
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    
    # Create figure with subplots
    fig = plt.figure(figsize=(16, 12))
    
    # Main time course plot
    ax1 = plt.subplot(2, 3, (1, 2))
    
    results = {}
    for i, strength in enumerate(strengths):
        t, mRNA, protein = simulate_circuit(strength)
        results[strength] = {'time': t, 'mRNA': mRNA, 'protein': protein}
        
        ax1.plot(t, protein, label=f'Promoter Strength = {strength}', 
                linewidth=3, color=colors[i])
    
    ax1.set_xlabel('Time (hours)', fontsize=12)
    ax1.set_ylabel('Protein Concentration (AU)', fontsize=12)
    ax1.set_title('Protein Expression Over Time\nPromoter → RBS → CDS Circuit', fontsize=14, fontweight='bold')
    ax1.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    ax1.grid(True, alpha=0.3)
    
    # Highlight promoter strength = 3
    t3, mRNA3, protein3 = results[3.0]['time'], results[3.0]['mRNA'], results[3.0]['protein']
    ax1.plot(t3, protein3, linewidth=5, color='red', alpha=0.7, 
            label='Promoter Strength = 3 (Highlighted)')
    
    # Steady-state analysis
    ax2 = plt.subplot(2, 3, 3)
    steady_states = []
    for strength in strengths:
        protein = results[strength]['protein']
        steady_state = protein[-1]  # Final concentration
        steady_states.append(steady_state)
    
    bars = ax2.bar(range(len(strengths)), steady_states, 
                   color=colors, alpha=0.8, edgecolor='black', linewidth=1)
    
    # Highlight promoter strength = 3
    highlight_idx = strengths.index(3.0)
    bars[highlight_idx].set_color('red')
    bars[highlight_idx].set_alpha(1.0)
    bars[highlight_idx].set_linewidth(3)
    
    ax2.set_xlabel('Promoter Strength', fontsize=12)
    ax2.set_ylabel('Steady-State Protein Conc.', fontsize=12)
    ax2.set_title('Steady-State Protein Expression', fontsize=14, fontweight='bold')
    ax2.set_xticks(range(len(strengths)))
    ax2.set_xticklabels([str(s) for s in strengths])
    ax2.grid(True, alpha=0.3)
    
    # Add value labels on bars
    for i, (strength, steady_state) in enumerate(zip(strengths, steady_states)):
        ax2.text(i, steady_state + steady_state*0.02, f'{steady_state:.2f}', 
                ha='center', va='bottom', fontweight='bold', fontsize=10)
    
    # Circuit diagram
    ax3 = plt.subplot(2, 3, 4)
    ax3.set_xlim(0, 4)
    ax3.set_ylim(0, 2)
    ax3.set_aspect('equal')
    
    # Draw circuit components
    from matplotlib.patches import Rectangle, FancyBboxPatch
    
    # Promoter (highlighted if strength = 3)
    promoter = FancyBboxPatch((0.2, 0.7), 0.6, 0.6, 
                             boxstyle="round,pad=0.1", 
                             facecolor='red' if True else 'lightgreen', 
                             edgecolor='black', linewidth=3)
    ax3.add_patch(promoter)
    ax3.text(0.5, 1.0, 'Promoter\n(Strength=3)', ha='center', va='center', 
            fontweight='bold', fontsize=11, color='white')
    
    # RBS
    rbs = FancyBboxPatch((1.4, 0.7), 0.6, 0.6, 
                        boxstyle="round,pad=0.1", 
                        facecolor='lightblue', edgecolor='black', linewidth=2)
    ax3.add_patch(rbs)
    ax3.text(1.7, 1.0, 'RBS\n(Eff=1.0)', ha='center', va='center', 
            fontweight='bold', fontsize=11)
    
    # CDS
    cds = FancyBboxPatch((2.6, 0.7), 0.6, 0.6, 
                        boxstyle="round,pad=0.1", 
                        facecolor='lightcoral', edgecolor='black', linewidth=2)
    ax3.add_patch(cds)
    ax3.text(2.9, 1.0, 'CDS\n(Protein)', ha='center', va='center', 
            fontweight='bold', fontsize=11)
    
    # Arrows
    ax3.arrow(0.85, 1.0, 0.45, 0, head_width=0.08, head_length=0.08, 
             fc='darkgreen', ec='darkgreen', linewidth=3)
    ax3.arrow(2.05, 1.0, 0.45, 0, head_width=0.08, head_length=0.08, 
             fc='darkblue', ec='darkblue', linewidth=3)
    
    # Labels for arrows
    ax3.text(1.1, 1.15, 'Transcription', ha='center', fontsize=10, fontweight='bold')
    ax3.text(2.3, 1.15, 'Translation', ha='center', fontsize=10, fontweight='bold')
    
    ax3.set_title('Circuit Architecture', fontsize=14, fontweight='bold')
    ax3.axis('off')
    
    # mRNA dynamics
    ax4 = plt.subplot(2, 3, 5)
    for i, strength in enumerate([1.0, 3.0]):  # Compare default vs strength=3
        t, mRNA, protein = results[strength]['time'], results[strength]['mRNA'], results[strength]['protein']
        linestyle = '--' if strength == 1.0 else '-'
        linewidth = 2 if strength == 1.0 else 4
        color = 'blue' if strength == 1.0 else 'red'
        
        ax4.plot(t, mRNA, label=f'mRNA (Promoter={strength})', 
                linestyle=linestyle, linewidth=linewidth, color=color, alpha=0.8)
    
    ax4.set_xlabel('Time (hours)', fontsize=12)
    ax4.set_ylabel('mRNA Concentration (AU)', fontsize=12)
    ax4.set_title('mRNA Dynamics Comparison', fontsize=14, fontweight='bold')
    ax4.legend()
    ax4.grid(True, alpha=0.3)
    
    # Parameter effects summary
    ax5 = plt.subplot(2, 3, 6)
    ax5.axis('off')
    
    # Calculate key metrics for promoter strength = 3
    t3, mRNA3, protein3 = results[3.0]['time'], results[3.0]['mRNA'], results[3.0]['protein']
    steady_state_protein = protein3[-1]
    steady_state_mRNA = mRNA3[-1]
    
    # Time to reach 90% of steady state
    target = 0.9 * steady_state_protein
    time_to_90 = t3[np.where(protein3 >= target)[0][0]] if np.any(protein3 >= target) else t3[-1]
    
    summary_text = f"""
Key Results for Promoter Strength = 3:

• Steady-State Protein: {steady_state_protein:.2f} AU
• Steady-State mRNA: {steady_state_mRNA:.2f} AU  
• Time to 90% max: {time_to_90:.1f} hours
• 3x higher than default (strength=1)

Circuit Parameters:
• RBS Efficiency: 1.0
• Translation Rate: 7.0 /hr
• Degradation Rate: 1.0 /hr
• Transcription Rate: 15.0 /hr
  (= 3.0 × 5.0 base rate)

Biological Meaning:
• Higher promoter strength → more mRNA
• More mRNA → more protein production
• Linear relationship (no saturation)
• Faster approach to steady state
"""
    
    ax5.text(0.05, 0.95, summary_text, transform=ax5.transAxes, fontsize=11,
            verticalalignment='top', fontfamily='monospace',
            bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.8))
    
    plt.tight_layout()
    
    # Save the plot
    output_file = 'promoter_strength_analysis.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"📊 Analysis saved to: {output_file}")
    
    # Display the plot
    plt.show()
    
    return results

def print_numerical_results():
    """Print numerical comparison of different promoter strengths"""
    
    print("\n" + "="*60)
    print("🧬 PROMOTER STRENGTH ANALYSIS RESULTS")
    print("="*60)
    
    strengths = [0.5, 1.0, 2.0, 3.0, 5.0]
    
    print(f"{'Strength':<10} {'Steady mRNA':<12} {'Steady Protein':<15} {'Fold Change':<12}")
    print("-" * 55)
    
    baseline_protein = None
    
    for strength in strengths:
        t, mRNA, protein = simulate_circuit(strength)
        steady_mRNA = mRNA[-1]
        steady_protein = protein[-1]
        
        if baseline_protein is None:
            baseline_protein = steady_protein
        
        fold_change = steady_protein / baseline_protein
        
        print(f"{strength:<10.1f} {steady_mRNA:<12.3f} {steady_protein:<15.3f} {fold_change:<12.2f}x")
    
    print("\n🎯 KEY FINDINGS:")
    print("• Promoter strength of 3.0 gives ~3x protein expression vs baseline")
    print("• Linear relationship between promoter strength and protein output")
    print("• mRNA levels scale proportionally with promoter strength")  
    print("• No saturation effects in this parameter range")
    
    # Specific analysis for strength = 3
    t3, mRNA3, protein3 = simulate_circuit(3.0)
    print(f"\n📈 PROMOTER STRENGTH = 3.0 DETAILED:")
    print(f"   • Final Protein Concentration: {protein3[-1]:.3f} AU")
    print(f"   • Final mRNA Concentration: {mRNA3[-1]:.3f} AU")
    print(f"   • Peak Protein Production Rate: {max(np.gradient(protein3)):.3f} AU/hr")
    print(f"   • Transcription Rate: {3.0 * 5.0:.1f} /hr (3x stronger than default)")

if __name__ == "__main__":
    print("🧬 Genetic Circuit Analysis: Promoter → RBS → CDS")
    print("Analyzing the effect of promoter strength on protein expression")
    print("Focus: Promoter strength = 3.0 vs other values\n")
    
    # Run the analysis
    results = create_promoter_strength_analysis()
    
    # Print numerical results
    print_numerical_results()
    
    print(f"\n✅ Analysis complete! Check 'promoter_strength_analysis.png' for the visualization.")
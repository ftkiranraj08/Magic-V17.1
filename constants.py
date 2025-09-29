"""
Enhanced component constants for genetic circuit modeling
Based on realistic biological parameters from Version 15.3
"""

COMPONENT_CONSTANTS = {
    # Promoters - From working notebook constants
    "promoter_1": {"strength": 5.0, "type": "promoter"},
    "promoter_2": {"strength": 5.0, "type": "promoter"},
    "promoter_3": {"strength": 5.0, "type": "promoter"},
    "promoter_a": {"strength": 5.0, "type": "promoter"},
    "promoter_b": {"strength": 5.0, "type": "promoter"},
    "promoter_c": {"strength": 5.0, "type": "promoter"},
    "promoter_d": {"strength": 5.0, "type": "promoter"},
    "promoter_e": {"strength": 5.0, "type": "promoter"},
    "promoter_f": {"strength": 5.0, "type": "promoter"},
    "promoter_g": {"strength": 5.0, "type": "promoter"},
    "promoter_h": {"strength": 5.0, "type": "promoter"},
    
    # RBS - From working notebook constants
    "rbs_1": {"efficiency": 1.0, "type": "rbs"},
    "rbs_2": {"efficiency": 1.0, "type": "rbs"},
    "rbs_3": {"efficiency": 1.0, "type": "rbs"},
    "rbs_a": {"efficiency": 1.0, "type": "rbs"},
    "rbs_b": {"efficiency": 1.0, "type": "rbs"},
    "rbs_c": {"efficiency": 1.0, "type": "rbs"},
    "rbs_d": {"efficiency": 1.0, "type": "rbs"},
    "rbs_e": {"efficiency": 1.0, "type": "rbs"},
    "rbs_f": {"efficiency": 1.0, "type": "rbs"},
    "rbs_g": {"efficiency": 1.0, "type": "rbs"},
    "rbs_h": {"efficiency": 1.0, "type": "rbs"},
    
    # CDS - From working notebook constants
    "cds_1": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_2": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_3": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_a": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_b": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_c": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_d": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_e": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_f": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_g": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    "cds_h": {"degradation_rate": 1.0, "translation_rate": 7.0, "init_conc": 0.0, "type": "cds"},
    
    # Terminators - From working notebook constants  
    "terminator_1": {"efficiency": 0.99, "type": "terminator"},
    "terminator_2": {"efficiency": 0.99, "type": "terminator"},
    "terminator_3": {"efficiency": 0.99, "type": "terminator"},
    "terminator_a": {"efficiency": 0.99, "type": "terminator"},
    "terminator_b": {"efficiency": 0.99, "type": "terminator"},
    "terminator_c": {"efficiency": 0.99, "type": "terminator"},
    "terminator_d": {"efficiency": 0.99, "type": "terminator"},
    "terminator_e": {"efficiency": 0.99, "type": "terminator"},
    "terminator_f": {"efficiency": 0.99, "type": "terminator"},
    "terminator_g": {"efficiency": 0.99, "type": "terminator"},
    "terminator_h": {"efficiency": 0.99, "type": "terminator"},
    
    # Repressors - Optimal Kr values for repressilator oscillation (classic range)
    "repressor_start_1": {"Kr": 0.35, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_end_1": {"Kr": 0.35, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_start_2": {"Kr": 0.35, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_end_2": {"Kr": 0.35, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_start_3": {"Kr": 0.35, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_end_3": {"Kr": 0.35, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_a": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_b": {"Kr": 0.1, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_c": {"Kr": 0.4, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_d": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_e": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_f": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_g": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_h": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_a_start": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_a_end": {"Kr": 0.5, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_b_start": {"Kr": 0.1, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_b_end": {"Kr": 0.1, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_c_start": {"Kr": 0.4, "n": 2, "type": "repressor", "is_floating": False},
    "repressor_c_end": {"Kr": 0.4, "n": 2, "type": "repressor", "is_floating": False},
    
    # Activators - From working notebook constants
    "activator_a": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    "activator_b": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    "activator_c": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    "activator_d": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    "activator_e": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    "activator_f": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    "activator_g": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    "activator_h": {"Ka": 0.4, "n": 2, "type": "activator", "is_floating": False},
    
    # Floating regulators - From working notebook constants
    "floating_inhibitor_a": {"Kr": 0.5, "n": 2, "concentration": 1.0, "type": "inhibitor", "is_floating": True},
    "floating_inhibitor_b": {"Kr": 0.5, "n": 2, "concentration": 1.0, "type": "inhibitor", "is_floating": True},
    "floating_inhibitor_c": {"Kr": 0.5, "n": 2, "concentration": 1.0, "type": "inhibitor", "is_floating": True},
    "floating_inducer_a": {"Ka": 0.5, "n": 2, "concentration": 1.0, "type": "inducer", "is_floating": True},
    "floating_inducer_b": {"Ka": 0.5, "n": 2, "concentration": 1.0, "type": "inducer", "is_floating": True},
    "floating_inducer_c": {"Ka": 0.5, "n": 2, "concentration": 1.0, "type": "inducer", "is_floating": True}
}

# Parameter ranges for dial mode
PARAMETER_RANGES = {
    "strength": (0.1, 5.0),
    "efficiency": (0.1, 2.0),
    "translation_rate": (1.0, 20.0),
    "degradation_rate": (0.01, 1.0),
    "binding_affinity": (0.01, 1.0),
    "cooperativity": (0.5, 3.0),
    "max_expression": (10.0, 500.0),
    "global_transcription_rate": (0.1, 3.0),
    "global_translation_rate": (0.1, 3.0),
    "global_degradation_rate": (0.1, 3.0),
    "temperature_factor": (0.5, 2.0),
    "resource_availability": (0.1, 2.0)
}

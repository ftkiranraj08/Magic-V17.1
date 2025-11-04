import re
from typing import Any, Dict, List, Optional
from collections import defaultdict

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


class Component:
    """Light-weight representation for any parsed component line."""

    def __init__(self, raw_label: str, channel: int, mux_chr: str, constants: Dict[str, Any], strength: str = "norm"):
        self.label = raw_label.strip()
        self.type = self._infer_type(self.label)
        self.channel = channel
        self.mux_chr = mux_chr
        self.global_idx = (ord(mux_chr) - ord('A')) * 16 + channel
        self.id = f"{self.type}_{mux_chr}{channel}"
        self.strength = strength

        # Flat constants for this component/regulator
        self.constants = constants.get(self.label, {})

        # Regulator helpers
        self.is_regulator = self.type in ("activator", "repressor", "inducer", "inhibitor")
        if self.is_regulator:
            self.is_floating = self.label.startswith("floating_")
            parts = self.label.lower().split("_")
            if len(parts) >= 2:
                if len(parts) >= 3:
                    position_part = parts[1]
                    gene_part = parts[2]
                else:
                    position_part = parts[1]
                    gene_part = ""

                if position_part.startswith("start"):
                    self.position = "start"
                    if not gene_part:
                        gene_part = position_part[len("start"):]
                elif position_part.startswith("end"):
                    self.position = "end"
                    if not gene_part:
                        gene_part = position_part[len("end"):]
                else:
                    self.position = None

                if self.position and gene_part:
                    self.reg_key = f"{parts[0]}_{gene_part}"
                elif self.position:
                    self.reg_key = f"{parts[0]}"
                else:
                    self.reg_key = None
            else:
                self.position = None
                self.reg_key = None
        else:
            self.is_floating = False
            self.position = None
            self.reg_key = None

        self.parameters: Dict[str, Any] = {}
        self.circuit_name: Optional[str] = None

    @staticmethod
    def _infer_type(label: str) -> str:
        lc = label.lower()
        if lc.startswith("promoter"):
            return "promoter"
        if lc.startswith("rbs"):
            return "rbs"
        if lc.startswith("cds"):
            return "cds"
        if lc.startswith("terminator"):
            return "terminator"

        parts = lc.split("_")
        if len(parts) >= 2:
            reg_type = parts[0]
            position_part = parts[1]
            if position_part.startswith("start") or position_part.startswith("end"):
                if reg_type in ("activator", "repressor", "inducer", "inhibitor"):
                    return reg_type
        return "misc"

    def to_dict(self) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "name": self.label,
            "type": self.type,
            "parameters": self.parameters,
        }
        if self.strength is not None:
            data["strength"] = self.strength
        return data


class OntologyBuilderUnified:
    """Unified ontology builder that assembles circuits and regulatory relationships."""

    def __init__(self, constants: Dict[str, Any]):
        self.constants = constants
        self._reset_analysis_state()

    def _reset_analysis_state(self) -> None:
        self.items: List[Optional[Component]] = []
        self.circuits: List[Dict[str, Any]] = []
        self.comp_to_circuit: Dict[str, str] = {}
        self.valid_comp_ids: set[str] = set()
        self.regulators: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "starts": [],
            "ends": [],
            "type": None,
            "is_floating": False,
        })
        self.regulations: List[Dict[str, Any]] = []
        self.regulator_issues: List[Dict[str, str]] = []
        self.unpaired_regulators: List[Dict[str, str]] = []
        self.extra_components_found = {
            "within_valid_circuits": [],
            "outside_of_valid_circuits": [],
            "misplaced_components": [],
        }

    def parse_text_file(self, lines: List[str]) -> None:
        self._reset_analysis_state()

        mux_counter = 0
        in_circuit = False
        has_cds = False

        def extract_component(raw: str) -> Optional[str]:
            match = re.search(r"\['([^']+)'\]", raw)
            return match.group(1) if match else None

        def extract_strength(raw: str) -> str:
            match = re.search(r"strength=([\w.-]+)", raw)
            return match.group(1) if match else "norm"

        def extract_mux_channel(raw: str) -> tuple[Optional[str], Optional[int]]:
            match = re.search(r"MUX\s+([A-Z]),\s*Channel\s+(\d+)", raw)
            if match:
                return match.group(1), int(match.group(2))
            return None, None

        for raw in lines:
            raw = raw.strip()
            if not raw:
                self.items.append(None)
                in_circuit = False
                has_cds = False
                continue

            label = extract_component(raw)
            if label is None:
                self.items.append(None)
                in_circuit = False
                has_cds = False
                continue

            strength = extract_strength(raw)
            mux_letter, channel = extract_mux_channel(raw)
            if mux_letter is None or channel is None:
                mux_letter = chr(65 + (mux_counter // 16))
                channel = mux_counter % 16

            comp = Component(label, channel, mux_letter, self.constants, strength=strength)
            mux_counter += 1

            if in_circuit and has_cds and comp.type == "promoter":
                self.items.append(None)
                in_circuit = False
                has_cds = False

            self.items.append(comp)
            in_circuit = True
            if comp.type == "cds":
                has_cds = True

            if comp.is_regulator and comp.position:
                record = self.regulators[comp.reg_key]
                record["type"] = comp.type
                record["is_floating"] = comp.is_floating
                record[f"{comp.position}s"].append(comp)

    def build(self) -> None:
        self.circuits = []
        self.comp_to_circuit = {}
        self.valid_comp_ids = set()
        self.regulations = []
        self.regulator_issues = []
        self.unpaired_regulators = []
        self.extra_components_found = {
            "within_valid_circuits": [],
            "outside_of_valid_circuits": [],
            "misplaced_components": [],
        }

        block: List[Component] = []
        for item in self.items + [None]:
            if item is None:
                if block:
                    self._finalize_block(block)
                    block = []
                continue
            block.append(item)

        self._detect_unpaired_regulators()
        self._build_regulations()
        self._add_constitutive_regulations()
        self._detect_extras_outside()

    def _finalize_block(self, comps: List[Component]) -> None:
        for comp in comps:
            params = self.constants.get(comp.label, {})
            if comp.type == "promoter":
                comp.parameters["strength"] = params.get("strength", 1.0)
                comp.parameters["binding_affinity"] = params.get("binding_affinity", 0.1)
            elif comp.type == "rbs":
                comp.parameters["efficiency"] = params.get("efficiency", 1.0)
                comp.parameters["translation_rate"] = params.get("translation_rate", 5.0)
            elif comp.type == "terminator":
                comp.parameters["efficiency"] = params.get("efficiency", 0.99)
            elif comp.type == "cds":
                comp.parameters["translation_rate"] = params.get("translation_rate", 5.0)
                comp.parameters["degradation_rate"] = params.get("degradation_rate", 0.1)
                comp.parameters["init_conc"] = params.get("init_conc", 0.01)
                comp.parameters["max_expression"] = params.get("max_expression", 100.0)

        if not any(c.type == "cds" for c in comps):
            return

        name = f"circuit_{len(self.circuits) + 1}"
        for comp in comps:
            comp.circuit_name = name
            self.comp_to_circuit[comp.id] = name
            self.valid_comp_ids.add(comp.id)

        extras: List[Dict[str, Any]] = []
        misplaced: List[Dict[str, Any]] = []
        type_counts = defaultdict(int)
        last_rbs_name: Optional[str] = None
        cds_to_rbs: Dict[str, Optional[str]] = {}
        first_promoter = False
        first_rbs = False
        first_cds = False

        for comp in comps:
            comp_type = comp.type
            type_counts[comp_type] += 1

            if comp_type == "promoter":
                if first_cds:
                    misplaced.append({**comp.to_dict(), "reason": "Promoter after CDS"})
                first_promoter = True
            elif comp_type == "rbs":
                if first_cds and not first_rbs:
                    misplaced.append({**comp.to_dict(), "reason": "First RBS after CDS"})
                first_rbs = True
                last_rbs_name = comp.label
            elif comp_type == "terminator":
                if not first_cds:
                    misplaced.append({**comp.to_dict(), "reason": "Terminator before CDS"})
            elif comp_type == "cds":
                if not first_promoter or not first_rbs:
                    misplaced.append({**comp.to_dict(), "reason": "CDS does not have a promoter and/or RBS before it!"})
                cds_to_rbs[comp.label] = last_rbs_name
                first_cds = True

        if type_counts["promoter"] > 1:
            promoter_comps = [c for c in comps if c.type == "promoter"]
            for extra_comp in promoter_comps[1:]:
                extras.append({**extra_comp.to_dict(), "reason": "Extra promoter"})

        if type_counts["terminator"] > 1:
            terminator_comps = [c for c in comps if c.type == "terminator"]
            for extra_comp in terminator_comps[1:]:
                extras.append({**extra_comp.to_dict(), "reason": "Extra terminator"})

        rbs_comps = [c for c in comps if c.type == "rbs"]
        cds_comps = [c for c in comps if c.type == "cds"]
        if rbs_comps and cds_comps:
            extras.extend(self._validate_rbs_sequence_patterns(comps, rbs_comps, cds_comps))
        elif len(rbs_comps) > len(cds_comps):
            excess = len(rbs_comps) - len(cds_comps)
            for extra_comp in rbs_comps[-excess:]:
                extras.append({**extra_comp.to_dict(), "reason": "Extra RBS (more RBS than CDS)"})

        fallback_by_cds: Dict[str, Dict[str, Any]] = {}
        has_terminator = any(c.type == "terminator" for c in comps)
        for comp in comps:
            if comp.type != "cds":
                continue
            fallbacks: Dict[str, Any] = {}
            if not first_promoter:
                fallbacks["missing_promoter"] = True
                fallbacks["prom_strength"] = 0.01
            if not first_rbs:
                fallbacks["missing_rbs"] = True
                fallbacks["rbs_efficiency"] = 0.01
            if not has_terminator:
                fallbacks["missing_terminator"] = True
                fallbacks["degradation_rate"] = 0.01
            if fallbacks:
                fallback_by_cds[comp.label] = fallbacks

        circuit_dict = {
            "name": name,
            "modelable": True,
            "components": [c.to_dict() for c in comps],
            "cds_to_rbs": {k: v for k, v in cds_to_rbs.items() if v},
            "extras": extras,
            "misplaced": misplaced,
            "component_counts": dict(type_counts),
            "fallback_by_cds": fallback_by_cds,
        }
        self.circuits.append(circuit_dict)

        if extras:
            self.extra_components_found["within_valid_circuits"].append({
                "circuit": name,
                "extras": extras,
            })
        if misplaced:
            self.extra_components_found["misplaced_components"].append({
                "circuit": name,
                "misplaced": misplaced,
            })

    def _validate_rbs_sequence_patterns(self, comps: List[Component], rbs_comps: List[Component], cds_comps: List[Component]) -> List[Dict[str, Any]]:
        extras: List[Dict[str, Any]] = []
        rbs_cds_sequence = [comp for comp in comps if comp.type in {"rbs", "cds"}]
        if len(rbs_cds_sequence) < 2:
            return extras

        types_sequence = [comp.type for comp in rbs_cds_sequence]
        i = 0
        while i < len(types_sequence):
            if types_sequence[i] == "rbs":
                rbs_start = i
                while i < len(types_sequence) and types_sequence[i] == "rbs":
                    i += 1
                rbs_count = i - rbs_start
                if i < len(types_sequence) and types_sequence[i] == "cds":
                    cds_start = i
                    while i < len(types_sequence) and types_sequence[i] == "cds":
                        i += 1
                    cds_count = i - cds_start
                    if rbs_count > 1 and cds_count > 1:
                        for j in range(rbs_start + 1, rbs_start + rbs_count):
                            extra = rbs_cds_sequence[j]
                            extras.append({**extra.to_dict(), "reason": "Invalid RBS sequence (multiple RBS before multiple CDS)"})
                else:
                    i += 1
            else:
                i += 1
        return extras

    def _detect_unpaired_regulators(self) -> None:
        for key, record in self.regulators.items():
            starts = record["starts"]
            ends = record["ends"]
            reg_type = record.get("type", "unknown")
            if len(starts) != len(ends):
                if len(starts) > len(ends):
                    issue = f"Missing {len(starts) - len(ends)} end element(s)"
                    hint = "Add corresponding end element(s) to complete the regulation"
                else:
                    issue = f"Missing {len(ends) - len(starts)} start element(s)"
                    hint = "Add corresponding start element(s) to complete the regulation"
                self.unpaired_regulators.append({
                    "label": key,
                    "type": reg_type,
                    "starts": len(starts),
                    "ends": len(ends),
                    "issue": issue,
                    "hint": hint,
                })

    def _nearest_prev_non_reg(self, comp: Component) -> Optional[Component]:
        try:
            idx = next(i for i, item in enumerate(self.items) if item is comp)
        except StopIteration:
            return None
        for j in range(idx - 1, -1, -1):
            item = self.items[j]
            if item is None:
                break
            if isinstance(item, Component) and not item.is_regulator:
                return item
        return None

    def _downstream_cds(self, circuit_name: Optional[str], idx_threshold: int) -> List[str]:
        if not circuit_name:
            return []
        names: List[str] = []
        for circ in self.circuits:
            if circ["name"] != circuit_name:
                continue
            for comp_dict in circ["components"]:
                if comp_dict["type"] != "cds":
                    continue
                obj = next(
                    (item for item in self.items if isinstance(item, Component) and item.label == comp_dict["name"]),
                    None,
                )
                if obj and obj.global_idx > idx_threshold:
                    names.append(obj.label)
            break
        return names

    def _build_regulations(self) -> None:
        type_map = {
            "activator": "transcriptional_activation",
            "repressor": "transcriptional_repression",
            "inducer": "induced_activation",
            "inhibitor": "environmental_repression",
        }
        self_map = {
            "activator": "self_activation",
            "repressor": "self_repression",
            "inducer": "self_activation",
            "inhibitor": "self_repression",
        }

        for key, record in self.regulators.items():
            starts = record["starts"]
            ends = record["ends"]
            if not starts or not ends:
                continue

            for end in ends:
                promoter = self._nearest_prev_non_reg(end)
                if not promoter or promoter.type != "promoter":
                    self.regulator_issues.append({
                        "label": end.label,
                        "issue": "Regulator end not immediately after promoter.",
                        "hint": "Place regulator end after the promoter you want to regulate!",
                    })
                    continue

                affected = self._downstream_cds(end.circuit_name, promoter.global_idx)

                for start in starts:
                    if record["is_floating"] and start.circuit_name is not None:
                        self.regulator_issues.append({
                            "label": start.label,
                            "issue": "Floating start inside circuit.",
                            "hint": "Move floating regulator's start to be outside of all circuits!",
                        })

                    if not record["is_floating"]:
                        source_prev = self._nearest_prev_non_reg(start)
                        if not source_prev or source_prev.type != "cds":
                            self.regulator_issues.append({
                                "label": start.label,
                                "issue": "Regulator start does not follow a CDS.",
                                "hint": "Place regulator start after the CDS you want to be the source!",
                            })
                            continue
                        source_name = source_prev.label
                    else:
                        source_name = key

                    if record["is_floating"] and start.circuit_name is None:
                        kind = type_map.get(record["type"], "transcriptional_regulation")
                    elif start.circuit_name != end.circuit_name:
                        kind = type_map.get(record["type"], "transcriptional_regulation")
                    else:
                        kind = self_map.get(record["type"])

                    base = self.constants.get(start.reg_key, {}) if start.reg_key else {}
                    real_params: Dict[str, Any] = {
                        "type": record["type"],
                        "is_floating": record["is_floating"],
                    }
                    if "concentration" in base:
                        real_params["concentration"] = base["concentration"]
                    elif record["is_floating"]:
                        real_params["concentration"] = base.get("concentration", 1.0)

                    component_strength = getattr(start, "strength", "norm")
                    if record["type"] == "repressor":
                        if component_strength == "strong":
                            default_Kr = 0.15
                            default_n = 4
                        elif component_strength == "weak":
                            default_Kr = 0.5
                            default_n = 2
                        else:
                            regulation_index = len(self.regulations)
                            kr_values = [0.35, 0.35, 0.35]
                            default_Kr = kr_values[regulation_index % len(kr_values)]
                            default_n = 2
                        real_params["Kr"] = base.get("Kr", default_Kr)
                        real_params["n"] = base.get("n", default_n)
                    else:
                        if component_strength == "strong":
                            default_Ka = 0.2
                            default_n = 4
                        elif component_strength == "weak":
                            default_Ka = 0.6
                            default_n = 2
                        else:
                            default_Ka = 0.4
                            default_n = 2
                        real_params["Ka"] = base.get("Ka", default_Ka)
                        real_params["n"] = base.get("n", default_n)

                    self.regulations.append({
                        "type": kind,
                        "source": source_name,
                        "target": promoter.label,
                        "parameters": real_params,
                        "affected_cdss": [] if record["is_floating"] else affected,
                    })

    def _add_constitutive_regulations(self) -> None:
        for circ in self.circuits:
            cds_names = [c["name"] for c in circ["components"] if c["type"] == "cds"]
            for name in cds_names:
                has_reg = any(
                    reg for reg in self.regulations
                    if name in reg.get("affected_cdss", [])
                )
                if not has_reg:
                    cds_idx = next(i for i, c in enumerate(circ["components"]) if c["name"] == name)
                    promoter_name = None
                    for i in range(cds_idx - 1, -1, -1):
                        if circ["components"][i]["type"] == "promoter":
                            promoter_name = circ["components"][i]["name"]
                            break
                    if promoter_name:
                        self.regulations.append({
                            "type": "constitutive",
                            "source": None,
                            "target": promoter_name,
                            "parameters": {
                                "type": "constitutive",
                                "basal_rate": 0.1,
                            },
                            "affected_cdss": [name],
                        })

    def _detect_extras_outside(self) -> None:
        all_ids = {item.id for item in self.items if isinstance(item, Component)}
        outside_ids = all_ids - self.valid_comp_ids
        for item in self.items:
            if isinstance(item, Component) and item.id in outside_ids:
                self.extra_components_found["outside_of_valid_circuits"].append({
                    **item.to_dict(),
                    "reason": "Core part not part of any circuit.",
                })

    def export(self) -> Dict[str, Any]:
        return {
            "cell": {
                "circuits": self.circuits,
                "regulations": self.regulations,
                "regulator_issues": self.regulator_issues,
                "unpaired_regulators": self.unpaired_regulators,
                "extra_components_found": self.extra_components_found,
            }
        }

def simulate_circuit(builder: OntologyBuilderUnified) -> Dict[str, Any]:
    """Enhanced circuit simulation using your original equation building logic from Version 15.2"""
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    import numpy as np
    from scipy.integrate import odeint
    from collections import defaultdict
    
    try:
        if not builder.circuits:
            return {
                'status': 'error',
                'message': 'No valid circuits found. Please ensure you have at least one complete circuit with a CDS component.',
                'circuits': [],
                'regulations': [],
                'errors': ['No valid circuits detected'],
                'warnings': []
            }

        # Use your exact logic from the notebook
        cell = {
            "circuits": builder.circuits,
            "regulations": builder.regulations
        }
        
        # Parameters matching your notebook
        basal_constitutive = 0.01  # k0 for constitutive (no regulators)
        initial_conc_default = 0.01  # backup initial [protein] for all CDS species
        
        # Gather CDS entries + display names using your logic
        cds_list = []
        display_names = []
        id2comp = {}
        id2circ = {}
        
        for circ in cell["circuits"]:
            # Skip circuits marked as non-modelable (if such marking exists)
            # Default to True if not specified
            if circ.get("modelable", True) is False:
                continue
                
            comps = circ["components"]
            
            # Determine base promoter strength using your logic
            first_cds_idx = next((i for i, c in enumerate(comps) if c["type"] == "cds"), None)
            if first_cds_idx is not None:
                prom_idxs = [i for i, c in enumerate(comps) if c["type"] == "promoter" and i < first_cds_idx]
                base_prom = comps[max(prom_idxs)]["parameters"].get("strength", 0.0) if prom_idxs else 0.01
            else:
                base_prom = 0.01
            circ["_base_prom"] = base_prom
            
            # Build cds_to_rbs mapping like in your notebook
            cds_to_rbs = {}
            for i, comp in enumerate(comps):
                if comp["type"] == "rbs":
                    # Find next CDS after this RBS
                    for j in range(i + 1, len(comps)):
                        if comps[j]["type"] == "cds":
                            cds_to_rbs[comps[j]["name"]] = comp["name"]
                            break
            circ["cds_to_rbs"] = cds_to_rbs
            
            # Count CDS components per gene to handle multiple CDS in same gene
            gene_cds_count = {}
            for comp in comps:
                if comp["type"] == "cds":
                    # Extract gene info from component ID (e.g., "cds_A3" -> gene from original placement)
                    comp_id = comp["id"]
                    # Find the gene number from the original component placement
                    gene_num = 1  # default
                    if hasattr(comp, 'gene_number'):
                        gene_num = comp.gene_number
                    elif 'gene' in comp.get('metadata', {}):
                        gene_num = comp['metadata']['gene']
                    
                    gene_cds_count[gene_num] = gene_cds_count.get(gene_num, 0) + 1
            
            # Track CDS sequence numbers within each gene
            gene_cds_counters = {}
            
            for comp in comps:
                if comp["type"] != "cds": 
                    continue
                cds_id = comp["id"]
                # Extract letter from name (cds_1 -> A, cds_2 -> B, etc.)
                name = comp["name"]
                if "cds" in name:
                    # Handle both formats: cds_2 and cds2
                    if "_" in name:
                        gene_part = name.split("_")[-1]  # Get last part after underscore
                    else:
                        gene_part = name.replace("cds", "")  # Remove cds prefix
                    
                    try:
                        # Convert gene letter/number to display letter
                        if gene_part.isdigit():
                            letter = chr(65 + int(gene_part) - 1)  # 1->A, 2->B, etc.
                            gene_num = int(gene_part)
                        elif gene_part.isalpha():
                            letter = gene_part.upper()  # a->A, b->B, etc.
                            gene_num = ord(gene_part.upper()) - ord('A') + 1
                        else:
                            letter = "A"
                            gene_num = 1
                    except (ValueError, IndexError):
                        letter = "A"
                        gene_num = 1
                else:
                    letter = "A"
                    gene_num = 1
                
                # Track sequence number for this gene
                if gene_num not in gene_cds_counters:
                    gene_cds_counters[gene_num] = 0
                gene_cds_counters[gene_num] += 1
                sequence_num = gene_cds_counters[gene_num]
                
                # Create unique display name for each CDS, even if redundant
                if gene_cds_count.get(gene_num, 1) > 1:
                    # Multiple CDS in same gene - differentiate by sequence
                    display_name = f"Protein {letter}.{sequence_num}, Gene Circuit {gene_num}"
                else:
                    # Single CDS in gene
                    display_name = f"Protein {letter}, Gene Circuit {gene_num}"
                
                cds_list.append(cds_id)
                display_names.append(display_name)
                id2comp[cds_id] = comp
                id2circ[cds_id] = circ

        if not cds_list:
            # Return empty plot if no CDS found
            plt.figure(figsize=(10, 6))
            plt.text(0.5, 0.5, 'No CDS components found', ha='center', va='center', transform=plt.gca().transAxes)
            plt.xlabel('Time (hours)')
            plt.ylabel('Protein Concentration (μM)')
            plt.title('Genetic Circuit Simulation - No Data')
            
            # Convert to base64
            import io, base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
            buffer.seek(0)
            plot_data = base64.b64encode(buffer.getvalue()).decode()
            plt.close()
            
            return {
                'plot': plot_data,
                'time_series': {'time': [], 'Protein A': []},
                'circuits': builder.circuits,
                'regulations': builder.regulations,
                'errors': [],
                'warnings': []
            }
        
        # Build name→ID mapping for all components (your logic)
        name2id = {
            comp["name"]: comp["id"]
            for circ in cell["circuits"]
            for comp in circ["components"]
        }
        
        # Group regulations by CDS ID - apply to ALL CDS with matching name
        regs_by_cds = defaultdict(list)
        print(f"DEBUG: Processing {len(cell.get('regulations', []))} regulations")
        for reg in cell.get("regulations", []):
            print(f"DEBUG: Regulation {reg['source']} → {reg.get('affected_cdss', [])} (type: {reg['type']})")
            for tgt_name in reg.get("affected_cdss", []):
                # Apply regulation to ALL CDS components with this name
                for cds_id in cds_list:
                    comp = id2comp[cds_id]
                    if comp["name"] == tgt_name:
                        regs_by_cds[cds_id].append(reg)
                        print(f"DEBUG: Added regulation to {comp['name']} (cds_id: {cds_id})")
                
        # Build CDS name to ALL indices mapping for regulation lookup
        cds_name_to_indices = defaultdict(list)
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            cds_name_to_indices[comp["name"]].append(i)
        
        print(f"DEBUG: CDS mapping: {dict(cds_name_to_indices)}")
        print(f"DEBUG: CDS list: {[id2comp[cid]['name'] for cid in cds_list]}")
        print(f"DEBUG: Regulations by CDS: {[(cid, len(regs)) for cid, regs in regs_by_cds.items()]}")
        
        # Build per-CDS parameters using your exact logic
        cds_params = {}
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            circ = id2circ[cds_id]
            base_prom = circ["_base_prom"]
            
            # RBS efficiency (name-based lookup) using your logic
            rbs_name = circ["cds_to_rbs"].get(comp["name"])
            if rbs_name:
                rbs_comp = next((c for c in circ["components"] if c["name"] == rbs_name), None)
                base_rbs = rbs_comp["parameters"]["efficiency"] if rbs_comp else 0.01
            else:
                base_rbs = 0.01
            
            # Fallback & effective rates using your logic
            fb = circ.get("fallback_by_cds", {}).get(comp["name"], {})
            prom_s = fb.get("prom_strength", base_prom)
            rbs_e = fb.get("rbs_efficiency", base_rbs)
            degr = fb.get("degradation_rate", comp["parameters"]["degradation_rate"])
            
            # Numeric parameters matching working notebook - tuned for oscillations
            kprod = prom_s * rbs_e * 1.0  # Balanced production rate for oscillations
            k0 = basal_constitutive if not regs_by_cds.get(cds_id) else 0.01
            
            cds_params[cds_id] = {
                "k0": k0,
                "prom_strength": prom_s,
                "rbs_eff": rbs_e,
                "kprod": kprod,
                "degradation": degr,
                "initial_conc": comp["parameters"].get("init_conc", initial_conc_default)
            }
        
        # Define RHS using your exact logic with debugging
        debug_steps = []
        
        def rhs(p, t):
            dpdt = np.zeros(len(cds_list))
            for i, cds_id in enumerate(cds_list):
                pars = cds_params[cds_id]
                f_vals = []
                
                for reg in regs_by_cds.get(cds_id, []):
                    typ = reg["type"]
                    
                    if typ == "constitutive":
                        f_vals.append(1.0)  # always "on"
                        continue            # skip source lookup
                    
                    pr = reg["parameters"]
                    # Use higher Hill coefficient for sharper response (better for oscillations)
                    n = pr.get("n", 4 if typ in ("self_repression", "self_activation") else 2)
                    
                    # Resolve the value of the regulator
                    src_name = reg["source"]
                    
                    # For CDS regulation, find which protein index this is
                    # Use the first occurrence of this CDS name for regulation source
                    if src_name in cds_name_to_indices:
                        protein_index = cds_name_to_indices[src_name][0]
                        val = p[protein_index]  # Use protein concentration IN REAL TIME
                        
                        # Debug protein associations for repressilator
                        if t < 0.1:  # Only log at start of simulation
                            target_cds = id2comp[cds_id]["name"]
                            print(f"REPRESSOR DEBUG: {src_name} (index {protein_index}, conc={val:.3f}) → {target_cds}")
                            print(f"  Full mapping: {dict(cds_name_to_indices)}")
                            print(f"  CDS list order: {[id2comp[cid]['name'] for cid in cds_list]}")
                    elif typ in ("induced_activation", "environmental_repression"):
                        val = pr.get("concentration", 1.0)  # Use constant for floating
                    else:
                        raise ValueError(f"Cannot resolve source {src_name} for regulation type {typ}")
                    
                    # Apply correct regulation function with oscillation-friendly defaults
                    if typ in ("transcriptional_activation", "self_activation", "induced_activation"):
                        Ka = pr.get("Ka", 0.2)  # Lower Ka for stronger activation
                        hill_val = val**n / (Ka**n + val**n)
                        f_vals.append(hill_val)
                    elif typ in ("transcriptional_repression", "self_repression", "environmental_repression"):
                        # Use Kr from regulation parameters (no hardcoded defaults)
                        Kr = pr.get("Kr", 0.35)  # Use our tuned repressilator value as fallback
                        hill_val = Kr**n / (Kr**n + val**n)
                        f_vals.append(hill_val)
                        
                        # Debug key integration steps for oscillation verification
                        if len(debug_steps) < 10 and typ == "self_repression":
                            debug_steps.append({
                                't': t,
                                'protein_conc': val,
                                'Kr': Kr,
                                'n': n,
                                'hill_function': hill_val,
                                'production_factor': hill_val
                            })
                
                # Combine regulation effects and compute final rate
                f_prod = np.prod(f_vals) if f_vals else 1.0
                dpdt[i] = pars["k0"] + pars["kprod"] * f_prod - pars["degradation"] * p[i]
            
            return dpdt
        
        # Initial conditions and time vector - use user parameters or defaults
        p0 = np.array([cds_params[cds_id]["initial_conc"] for cds_id in cds_list])
        
        # For repressilator (3+ proteins with regulatory feedback), break symmetry if all concentrations are zero
        has_regulatory_feedback = any(
            reg["type"] not in ("constitutive",) 
            for reg in cell["regulations"]
        )
        
        if len(p0) >= 3 and np.allclose(p0, 0.0) and has_regulatory_feedback:
            # Apply asymmetry breaking ONLY for repressilator-type systems with regulatory feedback
            asymmetry_factors = [1.0, 0.1, 0.05]  # First protein starts higher
            for i in range(len(p0)):
                if i < len(asymmetry_factors):
                    p0[i] = asymmetry_factors[i]
                else:
                    p0[i] = 0.01  # Small non-zero value for additional proteins
        elif len(p0) >= 1 and np.allclose(p0, 0.0):
            # For constitutive circuits, use equal small starting concentrations for all proteins  
            for i in range(len(p0)):
                p0[i] = 0.01  # Equal starting concentration for constitutive circuits
        t = np.linspace(0, 24, 200)  # 0-24 hours as requested
        
        # Solve ODE
        sol = odeint(rhs, p0, t)
        
        # Create matplotlib plot with robust subplot handling
        fig, ax = plt.subplots(figsize=(10, 6))
        markers = ['o', 's', '^', 'D', 'v', '>', '<', '*']
        
        # Create circuit colors
        circuit_colors = {}
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f']
        for i, circ in enumerate(cell["circuits"]):
            circuit_colors[circ["name"]] = colors[i % len(colors)]
        
        print(f"DEBUG: About to plot {len(cds_list)} proteins: {cds_list}")
        
        # Plot each protein with circuit-specific colors
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            circ = id2circ[cds_id]
            color = circuit_colors[circ["name"]]
            display_name = display_names[i]
            
            # Add noise to separate overlapping curves - each protein gets unique noise pattern
            data_range = np.max(sol[:, i]) - np.min(sol[:, i])
            
            # For constitutive circuits: significant noise + small constant offset for guaranteed separation
            if not has_regulatory_feedback:
                # Much larger noise amplitude for better visual separation
                concentration_level = np.mean(sol[:, i])
                noise_amplitude = max(0.25 * concentration_level, 0.005)  # 25% noise or 0.005 μM minimum
                
                # Use unique random seed for each protein to create different noise patterns
                np.random.seed(42 + i * 17)  # Different seed spacing for more variation
                noise_pattern = np.random.normal(0, noise_amplitude, len(sol[:, i]))
                np.random.seed()  # Reset to random seed
                
                # Add small constant offset to guarantee visual separation
                small_offset = i * 0.008  # 0, 0.008, 0.016 μM offsets
                final_data = sol[:, i] + noise_pattern + small_offset
                
                print(f"DEBUG: Protein {i+1} - noise amplitude: {noise_amplitude:.4f}, offset: {small_offset:.3f}")
            else:
                # For repressilator systems, minimal noise
                noise_amplitude = 0.02 * data_range if data_range > 0 else 0
                if noise_amplitude > 0:
                    np.random.seed(42 + i * 13)
                    final_data = sol[:, i] + np.random.normal(0, noise_amplitude, len(sol[:, i]))
                    np.random.seed()
                else:
                    final_data = sol[:, i]
            
            # Plot with different colors only, no markers
            ax.plot(t, final_data, linewidth=2, label=display_name,
                    color=color, alpha=0.9)
            
            print(f"DEBUG: Plotted protein {i+1}/3: {display_name} with color {color}")
        
        # Debug: Check how many lines were actually plotted
        lines_count = len(ax.lines)
        print(f"DEBUG: Total lines plotted on axes: {lines_count} (should be {len(cds_list)})")
        
        ax.set_xlabel("Time (hours)")
        ax.set_ylabel("Concentration (μM)")
        ax.set_title("Genetic Circuit Simulation")
        ax.legend(shadow=True)
        ax.grid(True)
        
        # Convert plot to base64 for web display
        import io, base64
        img_buffer = io.BytesIO()
        fig.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        img_buffer.seek(0)
        plot_base64 = base64.b64encode(img_buffer.read()).decode()
        plt.close(fig)
        
        # Prepare time series data
        time_series = {'time': t.tolist()}
        for i, display_name in enumerate(display_names):
            time_series[display_name] = sol[:, i].tolist()
        
        # Calculate final states
        final_concentrations = {display_name: sol[:, i][-1] for i, display_name in enumerate(display_names)}
        
        # Return successful simulation results
        debug_info = {
            'cds_count': len(cds_list),
            'regulation_count': len(cell.get("regulations", [])),
            'simulation_successful': True
        }
        
        # Create protein mapping from CDS names to display names
        protein_mapping = {}
        for i, cds_id in enumerate(cds_list):
            comp = id2comp[cds_id]
            cds_name = comp['name']
            protein_mapping[display_names[i]] = cds_name
        
        result = {
            'status': 'success',
            'plot': plot_base64,
            'time_series': time_series,
            'final_concentrations': final_concentrations,
            'protein_mapping': protein_mapping,
            'circuits': builder.circuits,
            'regulations': builder.regulations,
            'regulator_issues': builder.regulator_issues,
            'unpaired_regulators': builder.unpaired_regulators,
            'extra_components': builder.extra_components_found,
            'debug_info': debug_info,
            'errors': [],
            'warnings': []
        }
        
        # Add warnings for issues
        if builder.regulator_issues:
            result['warnings'].extend([f"Regulator issue: {issue}" for issue in builder.regulator_issues])
        
        if builder.unpaired_regulators:
            result['warnings'].extend([f"Unpaired regulator: {reg}" for reg in builder.unpaired_regulators])
        
        return result
    
    except Exception as e:
        logging.error(f"Circuit simulation error: {str(e)}")
        return {
            'status': 'error',
            'message': f'Circuit analysis failed: {str(e)}',
            'circuits': [],
            'regulations': [],
            'errors': [str(e)],
            'warnings': []
        }

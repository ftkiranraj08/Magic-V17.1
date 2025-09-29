# Genetic Circuit Designer

## Overview

The Genetic Circuit Designer is a sophisticated web-based platform for designing, simulating, and analyzing genetic circuits. It combines theoretical circuit modeling with physical hardware integration, featuring a drag-and-drop interface for circuit design, advanced parameter tuning, and EEPROM-based hardware control.

## Recent Changes

**August 18, 2025 - Per-Gene Dial Parameter System Implemented**
- Implemented per-gene parameter application system allowing different parameters for Gene 1, Gene 2, and Gene 3
- Added gene-specific parameter parsing (promoter1_strength, rbs2_efficiency, cds3_translation_rate, etc.)
- Enhanced dial parameter structure with component-specific override groups
- Maintained global multipliers for system-wide adjustments (global_transcription_rate, etc.)
- Implemented parameter hierarchy: gene-specific > generic overrides > global multipliers > base constants
- Added comprehensive debugging output showing parameter application per component
- Fixed issue where all genes showed identical simulation curves despite different dial settings
- Dial interface now supports independent control of each gene's components for realistic multi-gene circuits

**August 3, 2025 - EEPROM Component Name Integration Complete**
- Fixed EEPROM hex-to-ASCII conversion issues causing component name corruption ("omoto" → "omo")
- Integrated Excel file component naming format (Promotor_a-f, rbs_a-h, cds_a-h, etc.)
- Added parsing for specific EEPROM names: "omo" (promoter), "r_a" (repressor), "rbs_c", "cds_d", "terminator_b", etc.
- Enhanced hex dump parsing to properly handle null terminators and multi-line hex data
- Fixed component detection where actual hardware data was found on MUX A channels 0-3
- Improved component type mapping to recognize your specific naming patterns
- Enhanced gene suffix parsing to convert alphabetic suffixes (a=1, b=2, c=3, etc.)
- Added comprehensive debugging output showing detailed component parsing results

**July 29, 2025 - Hardware Board Integration Restored**
- Successfully integrated hardware board interpretation functionality from uploaded reference files
- Enhanced Web Serial API connection stability with proper Arduino reset timing (2-second delay)
- Implemented robust backend hardware data parsing with hex-to-ASCII conversion
- Added comprehensive component type recognition supporting various naming formats
- Improved EEPROM scanning with 750ms settling time between MUX channels
- Integrated automatic board scanning across all MUX channels (A and B, 0-15)
- Added real-time component placement on visual board from hardware data
- Implemented hardware circuit simulation with proper equation generation
- Fixed board connection detection issues with enhanced error handling and fallback methods

**July 13, 2025 - Enhanced RBS Sequence Validation**
- Implemented advanced RBS sequence pattern validation for biological accuracy
- Detects invalid patterns: multiple RBS before multiple CDS (rbs-rbs-cds-cds)
- Recognizes valid patterns: alternating (rbs-cds-rbs-cds) and grouped (rbs-cds-cds-cds)
- Provides clear error messages for improper component sequencing
- Maintains individual CDS modeling with "Protein A.1, Gene 1" labeling format
- Enhanced extra component detection with detailed reasoning for all component types

**July 12, 2025 - Critical ODE Equation Generator Fix**
- Fixed critical bug in protein regulation lookup that was causing identical outputs for different proteins
- Implemented proper CDS name-to-index mapping for cross-protein regulation
- Verified accurate oscillatory behavior with working notebook parameters (Kr=0.4,0.5,0.1, n=2)
- All proteins now show independent dynamics with proper anti-correlation between regulated pairs
- System now correctly handles both self-regulation and transcriptional regulation between circuits

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: HTML5, CSS3, JavaScript (ES6+), Bootstrap 5 with dark theme
- **Design Pattern**: Multi-page application with modular component architecture
- **UI Framework**: Custom CSS with Bootstrap integration for responsive design
- **Interactive Features**: Drag-and-drop circuit builder, real-time parameter controls, hardware interface

### Backend Architecture
- **Framework**: Flask (Python web framework)
- **Architecture Pattern**: MVC (Model-View-Controller) with component-based modeling
- **API Design**: RESTful endpoints for simulation and hardware control
- **Modeling Engine**: Custom genetic circuit simulation using numpy and matplotlib

### Data Storage Solutions
- **Configuration Storage**: JSON-based component constants and circuit parameters
- **Session Management**: Flask session handling with configurable secret keys
- **Hardware Integration**: EEPROM-based persistent storage for physical circuits

## Key Components

### 1. Circuit Modeling Engine (`circuit_model.py`)
- **OntologyBuilderUnified**: Advanced circuit parser and component manager
- **Component Class**: Lightweight representation of genetic circuit elements
- **Simulation Engine**: Mathematical modeling of gene expression and regulation
- **Problem Solved**: Complex genetic circuit behavior prediction and analysis
- **Chosen Solution**: Object-oriented modeling with unified component handling
- **Pros**: Extensible, maintainable, supports complex regulatory networks
- **Cons**: Computational complexity increases with circuit size

### 2. Component Constants System (`constants.py`)
- **Purpose**: Centralized biological parameter definitions
- **Structure**: Hierarchical configuration for promoters, RBS, CDS, terminators
- **Parameters**: Strength, efficiency, binding affinity, degradation rates
- **Alternative Considered**: Database storage
- **Rationale**: JSON format chosen for simplicity and version control

### 3. Web Interface
- **Main Designer** (`index.html`): Drag-and-drop circuit builder with gene tabs
- **Dial Mode** (`dial.html`): Advanced parameter tuning interface
- **EEPROM Control** (`eeprom.html`): Hardware integration dashboard
- **About Page** (`about.html`): Team and project information

### 4. JavaScript Modules
- **script.js**: Core circuit designer functionality and state management
- **eeprom.js**: Enhanced Web Serial API integration for hardware communication
- **Features**: Real-time UI updates, drag-and-drop handling, robust serial communication with Arduino reset handling, backend hardware data parsing, automatic board scanning

## Data Flow

1. **Circuit Design Phase**:
   - User selects genetic components from palette
   - Components placed on circuit board via drag-and-drop
   - Strength parameters selected through interactive menus

2. **Simulation Phase**:
   - Circuit configuration sent to `/simulate` endpoint
   - Backend processes using OntologyBuilderUnified
   - Mathematical simulation performed with numpy/scipy
   - Results visualized using matplotlib

3. **Hardware Integration**:
   - Circuit parameters transmitted to EEPROM via Web Serial API
   - Physical board configuration synchronized with software design
   - Real-time monitoring and control through web interface

## External Dependencies

### Python Libraries
- **Flask**: Web framework and routing
- **Flask-CORS**: Cross-origin resource sharing
- **NumPy**: Numerical computations and array operations
- **Matplotlib**: Plotting and visualization (headless mode)
- **SciPy**: Advanced mathematical functions (implied usage)

### Frontend Libraries
- **Bootstrap 5**: UI framework with dark theme
- **Font Awesome**: Icon library
- **Google Fonts**: Typography (Inter, Lexend Giga)

### Browser APIs
- **Web Serial API**: Hardware communication (Chrome 89+)
- **Canvas API**: Circuit visualization
- **Drag and Drop API**: Component placement

## Deployment Strategy

### Development Environment
- **Server**: Flask development server with debug mode
- **Host Configuration**: `0.0.0.0:5000` for container compatibility
- **Hot Reload**: Enabled for rapid development iteration

### Production Considerations
- **Security**: Environment-based session secret configuration
- **CORS**: Configured for cross-origin requests
- **Static Assets**: Served through Flask static file handling
- **Logging**: Configurable logging levels for debugging

### Hardware Requirements
- **Serial Communication**: Chrome/Edge 89+ for Web Serial API
- **EEPROM Support**: 11AA010 EEPROM integration
- **Microcontroller**: Arduino-compatible board support

### Scalability Features
- **Modular Component System**: Easy addition of new genetic components
- **Extensible Constants**: JSON-based parameter configuration
- **API-First Design**: Backend services accessible for integration
- **Responsive Design**: Multi-device compatibility

The architecture prioritizes modularity and extensibility, allowing for easy addition of new genetic components, simulation algorithms, and hardware integrations while maintaining a clean separation between the web interface, simulation engine, and hardware control systems.
// Simplified Genetic Circuit Designer JavaScript without Gene Tabs System

document.addEventListener('DOMContentLoaded', function() {
    // Simplified state management
    const state = {
        currentComponent: null,
        currentStrength: 'norm',
        placedComponents: [],
        componentCounts: {}, // For auto-numbering: promoter_1, promoter_2, etc.
        isDragging: false,
        draggedElement: null,
        // Cellboard format matching backend expectations
        cellboard: {
            'Promoter': [],
            'RBS': [],
            'CDS': [],
            'Terminator': [],
            'Repressor Start': [],
            'Repressor End': [],
            'Activator Start': [],
            'Activator End': [],
            'Inducer Start': [],
            'Inducer End': [],
            'Inhibitor Start': [],
            'Inhibitor End': []
        }
    };

    // DOM elements
    const components = document.querySelectorAll('.component');
    const cells = document.querySelectorAll('.cell');
    const simulateBtn = document.getElementById('simulate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const errorDisplay = document.getElementById('error-display');
    const plotContainer = document.getElementById('plot-container');

    // Initialize the application
    init();

    function init() {
        setupComponents();
        setupCells();
        setupButtons();
        setupDragAndDrop();
        setupGlobalClicks();
        setupDragModeToggle();
        updateSelectionStatus(); // Initialize status
        console.log('Simplified circuit designer initialized successfully');
    }

    // Setup global click handler to clear selection
    function setupGlobalClicks() {
        document.addEventListener('click', function(e) {
            // Check if click is outside component palette and board
            const isComponentClick = e.target.closest('.component');
            const isBoardClick = e.target.closest('.cell-board');
            const isPaletteClick = e.target.closest('.component-palette');
            
            if (!isComponentClick && !isBoardClick && !isPaletteClick) {
                // Clear selection if clicking outside
                if (state.currentComponent) {
                    clearComponentSelection();
                    state.currentComponent = null;
                    state.currentStrength = 'norm';
                    updateSelectionStatus();
                    console.log('Selection cleared');
                }
            }
        });
    }

    // Component selection and strength menu
    function setupComponents() {
        components.forEach(comp => {
            // Component click for selection and strength menu
            comp.addEventListener('click', function(e) {
                e.stopPropagation();
                
                // Clear previous selection
                clearComponentSelection();
                
                // Set current component
                state.currentComponent = this.dataset.component;
                state.currentStrength = 'norm'; // Default strength
                
                // Add selected state
                this.classList.add('selected');
                
                // Show placement mode on board
                showPlacementMode();
                
                // Handle strength menu if it exists (will be commented out, so default to 'norm')
                const menu = this.querySelector('.strength-menu');
                if (menu) {
                    // Hide all other menus
                    document.querySelectorAll('.strength-menu').forEach(m => {
                        if (m !== menu) m.style.display = 'none';
                    });
                    
                    // Toggle this menu
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                }
                
                // Visual feedback
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
                
                // Update selection status
                updateSelectionStatus();
                
                console.log(`Selected component: ${state.currentComponent}`);
            });

            // Strength selection
            const strengthOptions = comp.querySelectorAll('.strength-option');
            strengthOptions.forEach(option => {
                option.addEventListener('click', function(e) {
                    e.stopPropagation();
                    state.currentStrength = this.dataset.strength;
                    this.parentElement.style.display = 'none';
                    
                    // Visual feedback
                    const component = this.closest('.component');
                    component.style.boxShadow = `0 0 0 3px ${getStrengthColor(state.currentStrength)}`;
                    setTimeout(() => {
                        component.style.boxShadow = '';
                    }, 1000);
                });
            });
        });
    }

    // Cell board interaction
    function setupCells() {
        cells.forEach(cell => {
            // Click to place selected component
            cell.addEventListener('click', function(e) {
                if (state.currentComponent) {
                    const x = parseInt(this.dataset.x);
                    const y = parseInt(this.dataset.y);
                    
                    // Check if cell is already occupied
                    if (this.classList.contains('filled')) {
                        removeComponent(x, y);
                    } else {
                        // Place the component - use 'norm' as default strength when strength menus are commented out
                        const strength = state.currentStrength || 'norm';
                        placeComponent(x, y, state.currentComponent, strength);
                        
                                // Clear selection after placing
                        clearComponentSelection();
                        state.currentComponent = null;
                        state.currentStrength = 'norm';
                        updateSelectionStatus();
                    }
                } else {
                    // No component selected - show message
                    showSelectionHint();
                }
            });
            
            // Right-click to remove component
            cell.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                const x = parseInt(this.dataset.x);
                const y = parseInt(this.dataset.y);
                removeComponent(x, y);
            });
        });
    }

    // Dynamic parameter section creation
    function createDynamicParameterSection(componentType, componentNumber) {
        const dialAccordion = document.querySelector('.dial-accordion');
        if (!dialAccordion) return;
        
        // Skip parameter sections for regulator components (they use constants from constants.py)
        const regulatorTypes = ['Repressor Start', 'Repressor End', 'Activator Start', 'Activator End', 
                               'Inducer Start', 'Inducer End', 'Inhibitor Start', 'Inhibitor End'];
        if (regulatorTypes.includes(componentType)) {
            console.log(`Skipping parameter section for regulator component: ${componentType}`);
            return;
        }
        
        // Create unique ID for this component instance
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const sectionId = `${baseType}_${componentNumber}`;
        
        // Check if section already exists
        if (document.getElementById(`section_${sectionId}`)) {
            return; // Already exists
        }
        
        // Create the parameter section
        const section = document.createElement('details');
        section.className = 'dial-accordion-item';
        section.id = `section_${sectionId}`;
        
        const summary = document.createElement('summary');
        summary.className = 'dial-accordion-header';
        summary.textContent = `${componentType} ${componentNumber} Parameters`;
        
        const body = document.createElement('div');
        body.className = 'dial-accordion-body';
        
        const grid = document.createElement('div');
        grid.className = 'dial-grid';
        
        // Generate parameters based on component type
        const parameters = getComponentParameters(componentType, componentNumber);
        
        parameters.forEach(param => {
            const label = document.createElement('label');
            label.setAttribute('for', param.id);
            label.textContent = param.label;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.id = param.id;
            input.name = param.id;
            input.min = param.min;
            input.max = param.max;
            input.step = param.step;
            input.value = param.defaultValue;
            
            if (param.title) {
                input.title = param.title;
            }
            
            grid.appendChild(label);
            grid.appendChild(input);
        });
        
        body.appendChild(grid);
        section.appendChild(summary);
        section.appendChild(body);
        
        // Insert before the last section (or at the end)
        dialAccordion.appendChild(section);
        
        console.log(`Created parameter section for ${componentType} ${componentNumber}`);
    }
    
    // Get parameters for a specific component type
    function getComponentParameters(componentType, componentNumber) {
        // Skip parameters for regulator components
        const regulatorTypes = ['Repressor Start', 'Repressor End', 'Activator Start', 'Activator End', 
                               'Inducer Start', 'Inducer End', 'Inhibitor Start', 'Inhibitor End'];
        if (regulatorTypes.includes(componentType)) {
            return [];
        }
        
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const num = componentNumber;
        
        const commonParams = {
            'Promoter': [
                {
                    id: `promoter${num}_strength`,
                    label: 'Promoter Strength:',
                    min: 0.1,
                    max: 5.0,
                    step: 0.1,
                    defaultValue: 1.0
                }
            ],
            'RBS': [
                {
                    id: `rbs${num}_efficiency`,
                    label: 'RBS Efficiency:',
                    min: 0.1,
                    max: 2.0,
                    step: 0.1,
                    defaultValue: 1.0
                }
            ],
            'CDS': [
                {
                    id: `cds${num}_translation_rate`,
                    label: 'CDS Translation Rate:',
                    min: 1.0,
                    max: 20.0,
                    step: 0.5,
                    defaultValue: 5.0
                },
                {
                    id: `cds${num}_degradation_rate`,
                    label: 'CDS Degradation Rate:',
                    min: 0.01,
                    max: 1.0,
                    step: 0.01,
                    defaultValue: 0.1
                },
                {
                    id: `protein${num}_initial_conc`,
                    label: 'Initial Protein Conc:',
                    min: 0.0,
                    max: 2.0,
                    step: 0.05,
                    defaultValue: 0.1,
                    title: 'Starting concentration (µM) - affects oscillation dynamics'
                }
            ],
            'Terminator': [
                {
                    id: `terminator${num}_efficiency`,
                    label: 'Terminator Efficiency:',
                    min: 0.1,
                    max: 1.0,
                    step: 0.01,
                    defaultValue: 0.99
                }
            ]
        };
        
        return commonParams[componentType] || [];
    }

    // Component placement logic
    function placeComponent(x, y, componentType, strength = 'norm') {
        // Auto-increment component number based on type
        const baseType = componentType.toLowerCase().replace(' ', '_');
        if (!state.componentCounts[baseType]) {
            state.componentCounts[baseType] = 1;
        } else {
            state.componentCounts[baseType]++;
        }

        const component = {
            x: x,
            y: y,
            type: componentType,
            strength: strength,
            id: Date.now() + Math.random(), // Unique ID
            number: state.componentCounts[baseType] // For display
        };
        
        // Add to cellboard in backend-compatible format
        if (!state.cellboard[componentType]) {
            state.cellboard[componentType] = [];
        }
        state.cellboard[componentType].push(component);
        
        // Create dynamic parameter section for this component
        createDynamicParameterSection(componentType, state.componentCounts[baseType]);
        
        // Update visual representation
        updateCellDisplay(x, y, componentType, state.componentCounts[baseType]);
        
        console.log(`Placed ${componentType} #${state.componentCounts[baseType]} at (${x}, ${y})`);
        return component;
    }

    function removeComponent(x, y) {
        // Find and remove component at this position
        let removed = null;
        
        for (const [type, components] of Object.entries(state.cellboard)) {
            const index = components.findIndex(comp => comp.x === x && comp.y === y);
            if (index !== -1) {
                removed = components.splice(index, 1)[0];
                break;
            }
        }
        
        if (removed) {
            // Remove corresponding parameter section
            removeDynamicParameterSection(removed.type, removed.number);
            
            // Clear visual representation
            const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
            if (cell) {
                cell.innerHTML = '';
                cell.classList.remove('filled');
            }
            console.log(`Removed ${removed.type} from (${x}, ${y})`);
        }
        
        return removed;
    }
    
    // Remove dynamic parameter section
    function removeDynamicParameterSection(componentType, componentNumber) {
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const sectionId = `section_${baseType}_${componentNumber}`;
        const section = document.getElementById(sectionId);
        
        if (section) {
            section.remove();
            console.log(`Removed parameter section for ${componentType} ${componentNumber}`);
        }
    }

    function updateCellDisplay(x, y, componentType, componentNumber, customName = null) {
        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        
        // Clear previous content
        cell.innerHTML = '';
        cell.classList.add('filled');
        
        // Find the component in our data to get its custom name
        let component = null;
        for (const [type, components] of Object.entries(state.cellboard)) {
            component = components.find(comp => comp.x === x && comp.y === y);
            if (component) break;
        }
        
        // Create component display
        const display = document.createElement('div');
        display.className = 'placed-component';
        display.textContent = getComponentSymbol(componentType);
        
        // Use custom name if available, otherwise default
        const displayName = (component && component.customName) || `${componentType} #${componentNumber}`;
        display.title = displayName;
        
        // Add component-specific styling
        display.classList.add(`component-${componentType.toLowerCase().replace(' ', '-')}`);
        
        // Add double-click event for renaming
        display.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            showRenameDialog(x, y, componentType, componentNumber, displayName);
        });
        
        cell.appendChild(display);
    }

    function getComponentSymbol(type) {
        const symbols = {
            'Promoter': 'P',
            'RBS': 'R',
            'CDS': 'C',
            'Terminator': 'T',
            'Repressor Start': 'Rs',
            'Repressor End': 'Re',
            'Activator Start': 'As',
            'Activator End': 'Ae',
            'Inducer Start': 'Is',
            'Inducer End': 'Ie',
            'Inhibitor Start': 'Ins',
            'Inhibitor End': 'Ine'
        };
        return symbols[type] || type.charAt(0);
    }

    function clearComponentSelection() {
        // Remove selected class from all components
        document.querySelectorAll('.component.selected').forEach(comp => {
            comp.classList.remove('selected');
        });
        
        // Hide placement mode
        hidePlacementMode();
    }

    function showPlacementMode() {
        // Add placement mode class to board
        const board = document.querySelector('.cell-board');
        if (board) {
            board.classList.add('placement-mode');
        }
        
        // Add hover effects to empty cells
        cells.forEach(cell => {
            if (!cell.classList.contains('filled')) {
                cell.classList.add('placement-ready');
            }
        });
    }

    function hidePlacementMode() {
        // Remove placement mode class from board
        const board = document.querySelector('.cell-board');
        if (board) {
            board.classList.remove('placement-mode');
        }
        
        // Remove hover effects from cells
        cells.forEach(cell => {
            cell.classList.remove('placement-ready');
        });
    }

    function showSelectionHint() {
        // Show a brief hint that user needs to select a component first
        const hint = document.createElement('div');
        hint.className = 'selection-hint';
        hint.textContent = 'Select a component first!';
        hint.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(231, 76, 60, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            font-weight: bold;
            animation: fadeInOut 2s ease-in-out;
        `;
        
        document.body.appendChild(hint);
        
        // Remove hint after animation
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 2000);
    }

    function updateSelectionStatus() {
        const statusElement = document.getElementById('selection-status');
        if (!statusElement) return;
        
        const icon = statusElement.querySelector('i');
        const text = statusElement.querySelector('span');
        
        if (state.currentComponent) {
            icon.className = 'fas fa-check-circle';
            text.textContent = `Selected: ${state.currentComponent}`;
            statusElement.className = 'selection-status selected';
        } else {
            icon.className = 'fas fa-mouse-pointer';
            text.textContent = 'Click a component to select';
            statusElement.className = 'selection-status';
        }
    }

    function setupDragModeToggle() {
        const toggle = document.getElementById('drag-mode-toggle');
        if (!toggle) return;
        
        toggle.addEventListener('change', function() {
            const isDragEnabled = this.checked;
            
            // Toggle draggable attribute on all components
            components.forEach(comp => {
                comp.draggable = isDragEnabled;
                if (isDragEnabled) {
                    comp.style.cursor = 'grab';
                } else {
                    comp.style.cursor = 'pointer';
                }
            });
            
            console.log(`Drag mode ${isDragEnabled ? 'enabled' : 'disabled'}`);
        });
    }

    function showRenameDialog(x, y, componentType, componentNumber, currentName) {
        // Find the component in our data
        let component = null;
        for (const [type, components] of Object.entries(state.cellboard)) {
            component = components.find(comp => comp.x === x && comp.y === y);
            if (component) break;
        }
        
        if (!component) return;
        
        // Create a simple prompt dialog
        const newName = prompt(`Enter new name for ${componentType} #${componentNumber}:`, 
                              component.customName || `${componentType} ${componentNumber}`);
        
        if (newName && newName.trim() !== '') {
            renameComponent(x, y, newName.trim());
        }
    }

    function renameComponent(x, y, newName) {
        // Find the component in our data
        let component = null;
        let componentType = null;
        for (const [type, components] of Object.entries(state.cellboard)) {
            component = components.find(comp => comp.x === x && comp.y === y);
            if (component) {
                componentType = type;
                break;
            }
        }
        
        if (!component) return;
        
        // Update the component's custom name
        component.customName = newName;
        
        // Update the visual display
        updateCellDisplay(x, y, componentType, component.number);
        
        // Update the parameter section title
        updateParameterSectionTitle(componentType, component.number, newName);
        
        console.log(`Renamed component at (${x}, ${y}) to "${newName}"`);
    }

    function updateParameterSectionTitle(componentType, componentNumber, customName) {
        const baseType = componentType.toLowerCase().replace(' ', '_');
        const sectionId = `section_${baseType}_${componentNumber}`;
        const section = document.getElementById(sectionId);
        
        if (section) {
            const summary = section.querySelector('.dial-accordion-header');
            if (summary) {
                summary.textContent = `${customName} Parameters`;
            }
        }
    }

    // Drag and drop functionality
    function setupDragAndDrop() {
        // Setup dragging from component palette
        components.forEach(component => {
            component.addEventListener('dragstart', function(e) {
                state.isDragging = true;
                state.draggedElement = this;
                const componentType = this.dataset.component;
                
                e.dataTransfer.setData('text/plain', componentType);
                e.dataTransfer.effectAllowed = 'copy';
                
                // Visual feedback
                this.style.opacity = '0.5';
            });
            
            component.addEventListener('dragend', function(e) {
                state.isDragging = false;
                state.draggedElement = null;
                this.style.opacity = '1';
            });
        });
        
        // Setup drop targets (cells)
        cells.forEach(cell => {
            cell.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                
                // Visual feedback
                this.classList.add('drop-target');
            });
            
            cell.addEventListener('dragleave', function(e) {
                this.classList.remove('drop-target');
            });
            
            cell.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drop-target');
                
                const componentType = e.dataTransfer.getData('text/plain');
                const x = parseInt(this.dataset.x);
                const y = parseInt(this.dataset.y);
                
                // Check if cell is already occupied
                if (this.classList.contains('filled')) {
                    removeComponent(x, y);
                }
                
                // Place the component
                placeComponent(x, y, componentType, state.currentStrength);
            });
        });
    }

    // Button setup
    function setupButtons() {
        if (simulateBtn) {
            simulateBtn.addEventListener('click', runSimulation);
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', clearBoard);
        }
    }

    // Simulation functions
    async function runSimulation() {
        try {
            // Show loading state
            const originalText = simulateBtn.textContent;
            simulateBtn.textContent = 'Simulating...';
            simulateBtn.disabled = true;
            
            // Collect dial parameters
            const dialData = collectDialParameters();
            
            // Prepare simulation data
            const simulationData = {
                cellboard: state.cellboard,
                dial: dialData,
                apply_dial: true
            };
            
            console.log('Sending simulation data:', simulationData);
            
            // Send to backend
            const response = await fetch('/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(simulationData)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                displaySimulationResults(result);
            } else {
                throw new Error(result.message || 'Simulation failed');
            }
            
        } catch (error) {
            console.error('Simulation error:', error);
            displayError('Simulation failed: ' + error.message);
        } finally {
            // Restore button state
            simulateBtn.textContent = 'Run Enhanced Simulation';
            simulateBtn.disabled = false;
        }
    }

    function collectDialParameters() {
        const dialData = {};
        
        // Collect all dial inputs (including dynamic ones)
        document.querySelectorAll('#dial-form input[type="number"]').forEach(input => {
            const key = input.name || input.id;
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
                dialData[key] = value;
            }
        });
        
        console.log('Collected dial parameters:', dialData);
        return dialData;
    }

    function displaySimulationResults(result) {
        if (!plotContainer) return;
        
        // Clear previous results
        plotContainer.innerHTML = '';
        
        // Create results container
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'simulation-results';
        
        // Add plot if available
        if (result.plot_data) {
            const plotImg = document.createElement('img');
            plotImg.src = `data:image/png;base64,${result.plot_data}`;
            plotImg.className = 'simulation-plot';
            plotImg.alt = 'Simulation Results';
            resultsDiv.appendChild(plotImg);
        }
        
        // Add equations if available
        if (result.equations) {
            const equationsDiv = document.createElement('div');
            equationsDiv.className = 'equations-container';
            equationsDiv.innerHTML = '<h3>Circuit Equations</h3>';
            
            Object.entries(result.equations).forEach(([protein, eq]) => {
                const eqDiv = document.createElement('div');
                eqDiv.className = 'equation-item';
                eqDiv.innerHTML = `
                    <h4>${protein}</h4>
                    <div class="equation-latex">${eq.latex}</div>
                    <p class="equation-description">${eq.description}</p>
                `;
                equationsDiv.appendChild(eqDiv);
            });
            
            resultsDiv.appendChild(equationsDiv);
        }
        
        plotContainer.appendChild(resultsDiv);
        
        // Render LaTeX equations if MathJax is available
        if (window.MathJax) {
            MathJax.typesetPromise([plotContainer]).catch(err => {
                console.error('MathJax error:', err);
            });
        }
    }

    function displayError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = 'block';
            setTimeout(() => {
                errorDisplay.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    function clearBoard() {
        // Clear all placed components
        for (const type in state.cellboard) {
            state.cellboard[type] = [];
        }
        
        // Reset component counts
        state.componentCounts = {};
        
        // Remove all dynamic parameter sections
        clearAllDynamicParameterSections();
        
        // Clear visual representation
        cells.forEach(cell => {
            cell.innerHTML = '';
            cell.classList.remove('filled');
        });
        
        // Clear results
        if (plotContainer) {
            plotContainer.innerHTML = `
                <div class="loading">
                    <i class="fas fa-dna" style="color: var(--primary); font-size: 2rem;"></i>
                    <p>Design your circuit and run enhanced simulation</p>
                </div>
            `;
        }
        
        console.log('Board cleared');
    }
    
    // Clear all dynamic parameter sections
    function clearAllDynamicParameterSections() {
        const dialAccordion = document.querySelector('.dial-accordion');
        if (!dialAccordion) return;
        
        // Remove all sections that have an ID starting with 'section_'
        const dynamicSections = dialAccordion.querySelectorAll('[id^="section_"]');
        dynamicSections.forEach(section => {
            section.remove();
        });
        
        console.log('Cleared all dynamic parameter sections');
    }

    function getStrengthColor(strength) {
        const colors = {
            'weak': '#fca5a5',
            'norm': '#fcd34d', 
            'strong': '#86efac'
        };
        return colors[strength] || colors['norm'];
    }

    // Hide all strength menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.component')) {
            document.querySelectorAll('.strength-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });

    // Export functions for external use
    window.CircuitDesigner = {
        state,
        placeComponent,
        removeComponent,
        runSimulation,
        clearBoard
    };
});
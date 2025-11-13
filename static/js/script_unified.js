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
        console.log('Simplified circuit designer initialized successfully');
    }

    // Component selection and strength menu
    function setupComponents() {
        components.forEach(comp => {
            // Component click for selection and strength menu
            comp.addEventListener('click', function(e) {
                e.stopPropagation();
                state.currentComponent = this.dataset.component;
                
                // Handle strength menu if it exists
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
                    }
                    
                    // Place the component
                    placeComponent(x, y, state.currentComponent, state.currentStrength);
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

    function updateCellDisplay(x, y, componentType, componentNumber) {
        const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;
        
        // Clear previous content
        cell.innerHTML = '';
        cell.classList.add('filled');
        
        // Create component display
        const display = document.createElement('div');
        display.className = 'placed-component';
        display.textContent = getComponentSymbol(componentType);
        display.title = `${componentType} #${componentNumber}`;
        
        // Add component-specific styling
        display.classList.add(`component-${componentType.toLowerCase().replace(' ', '-')}`);
        
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
        
        // Collect all dial inputs
        document.querySelectorAll('#dial-form input[type="number"]').forEach(input => {
            const key = input.name || input.id;
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
                dialData[key] = value;
            }
        });
        
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
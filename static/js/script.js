// static/js/script.js
// Enhanced Genetic Circuit Designer JavaScript with Version 15.3 Integration

document.addEventListener('DOMContentLoaded', function() {
    // State management
    const state = {
        currentComponent: null,
        currentStrength: 'norm',
        currentGene: '1',
        placedComponents: [],
        isDragging: false,
        draggedElement: null
    };

    // DOM elements
    const geneTabs = document.querySelectorAll('.gene-tab');
    const genePanels = document.querySelectorAll('.gene-panel');
    const components = document.querySelectorAll('.component');
    const cells = document.querySelectorAll('.cell');
    const simulateBtn = document.getElementById('simulate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const helpBtn = document.getElementById('help-btn');
    const errorDisplay = document.getElementById('error-display');
    const plotContainer = document.getElementById('plot-container');
    const dialForm = document.getElementById('dial-form'); // Will be null on index.html

    // Initialize the application
    init();
    
    // Run automatic test if in debug mode
    if (window.location.search.includes('test=true')) {
        setTimeout(() => {
            console.log('Auto-running hardware data transfer test...');
            window.testHardwareDataTransfer();
        }, 1000);
    }

    function init() {
        setupGeneTabs();
        setupComponents();
        setupCells();
        setupButtons();
        setupDragAndDrop();
        setupDialToggle();
        setupJsPlumb();
        setupSvgConnectors();
        setupAddGeneButton();
    setupRemoveGeneButton();
        
        // Initialize with the first available Gene tab active (query dynamically)
        const firstTab = document.querySelector('#gene-tabs .gene-tab');
        if (firstTab) {
            // dispatch a click so the delegated handler activates it
            firstTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
        
        // Check for hardware circuit data and load it
        loadHardwareCircuitData();
    }

    // jsPlumb integration for connecting repressor start -> repressor end
    function setupJsPlumb() {
        // If jsPlumb isn't present, attempt to load it dynamically from fallbacks (CDNs/local)
        if (typeof jsPlumb === 'undefined' && typeof window.jsPlumb === 'undefined') {
            console.warn('jsPlumb not found — attempting dynamic load from fallbacks');
            const fallbacks = [
                'https://cdnjs.cloudflare.com/ajax/libs/jsPlumb/1.7.11/jquery.jsPlumb-1.7.11-min.js',
                'https://cdn.jsdelivr.net/gh/jsplumb/jsplumb@1.7.11/dist/js/jsplumb.min.js',
                // local fallback (place file at static/vendor/jquery.jsPlumb-1.7.11-min.js)
                window.location.origin + '/static/vendor/jquery.jsPlumb-1.7.11-min.js'
            ];

            function tryLoad(index) {
                if (index >= fallbacks.length) {
                    console.warn('All jsPlumb fallbacks failed');
                    return Promise.resolve(false);
                }
                return new Promise(function(resolve) {
                    const s = document.createElement('script');
                    s.src = fallbacks[index];
                    s.async = false;
                    s.onload = function() { console.log('Loaded jsPlumb fallback:', fallbacks[index]); resolve(true); };
                    s.onerror = function() { console.warn('Failed to load jsPlumb fallback:', fallbacks[index]); resolve(tryLoad(index + 1)); };
                    document.head.appendChild(s);
                });
            }

            // Try to load then re-run setup after successful load
            tryLoad(0).then(function(success) {
                if (success && (typeof jsPlumb !== 'undefined' || typeof window.jsPlumb !== 'undefined')) {
                    // Small delay to ensure the library is fully initialised
                    setTimeout(setupJsPlumb, 50);
                } else {
                    console.warn('jsPlumb could not be loaded; connector features will be disabled.');
                }
            });

            return; // bail for now; will re-enter when loaded
        }

        const J = (window.jsPlumb || jsPlumb).getInstance();
    // Render connectors into the document body to avoid being clipped by container overflow
    try { J.setContainer(document.body); } catch (e) { /* ignore if not supported */ }

        // common endpoint settings
        const sourceEndpoint = {
            endpoint: 'Dot',
            paintStyle: { fill: '#a78bfa', radius: 6 },
            isSource: true,
            maxConnections: 1,
            connector: ['Bezier', { curviness: 50 }],
            connectorStyle: { stroke: '#a78bfa', strokeWidth: 3 },
            anchors: ['Right'],
            overlays: [
                ['Arrow', { width: 10, length: 12, location: 1 }]
            ]
        };

        const targetEndpoint = {
            endpoint: 'Dot',
            paintStyle: { fill: '#7E22CE', radius: 6 },
            isTarget: true,
            maxConnections: 1,
            anchors: ['Left']
        };

        function addEndpointsForElement(el) {
            // only attach once
            if (el._jsplumbAttached) return;
            el._jsplumbAttached = true;
            // only attach for placed board nodes inside grid, not palette
            if (!el.classList.contains('component-node')) return;
            if (!el.closest('.grid-container')) return;
            const compType = el.dataset.component;
            // Only create handles/endpoints for Repressor Start and Repressor End
            if (compType === 'Repressor Start') {
                // create a small handle element for visual affordance (source)
                const handle = document.createElement('div');
                handle.className = 'connection-handle connection-source';
                el.appendChild(handle);
                J.addEndpoint(el, sourceEndpoint);
            } else if (compType === 'Repressor End') {
                // create a small handle element for visual affordance (target)
                const tHandle = document.createElement('div');
                tHandle.className = 'connection-handle connection-target';
                el.appendChild(tHandle);
                J.addEndpoint(el, targetEndpoint);
            }
        }

    // expose single-element attach API so other code can call it when elements are updated
    try { window.__attachJsPlumbEndpoint = addEndpointsForElement; } catch (e) { /* ignore */ }

    // Attach only to placed board nodes
    document.querySelectorAll('.component-node').forEach(addEndpointsForElement);

        // Observe for dynamic additions
        const obs = new MutationObserver(() => {
            document.querySelectorAll('.component-node').forEach(addEndpointsForElement);
        });
        obs.observe(document.body, { childList: true, subtree: true });

        // Handle new connections
        J.bind('connection', function(info) {
            // Prevent duplicate connections between the same source and target
            try {
                const existing = J.getConnections({ source: info.source, target: info.target }) || [];
                // Remove all but the newest connection for this pair
                if (existing.length > 1) {
                    for (let i = 0; i < existing.length - 1; i++) {
                        try { J.detach(existing[i]); } catch (e) { /* ignore detach errors */ }
                    }
                }
                // Also enforce one connection per source and per target overall
                const fromSource = J.getConnections({ source: info.source }) || [];
                fromSource.forEach(c => { if (c !== info.connection) { try { J.detach(c); } catch (e) {} } });
                const toTarget = J.getConnections({ target: info.target }) || [];
                toTarget.forEach(c => { if (c !== info.connection) { try { J.detach(c); } catch (e) {} } });
            } catch (e) {
                // fallback: remove previous from state
                state.placedConnections = state.placedConnections || [];
                state.placedConnections = state.placedConnections.filter(c => !(c.source === info.source.dataset.component && c.target === info.target.dataset.component));
            }

            console.log('New connection:', info);
            // store connection info in state or serialize to server
            state.placedConnections = state.placedConnections || [];
            state.placedConnections.push({ source: info.source.dataset.component, target: info.target.dataset.component, uuid: info.connection.id });
        });

        // Optional: attempt to auto-connect any existing Repressor Start -> Repressor End endpoints
        setTimeout(() => {
            try {
                const starts = Array.from(document.querySelectorAll('.component-node')).filter(c => c.dataset.component === 'Repressor Start');
                const ends = Array.from(document.querySelectorAll('.component-node')).filter(c => c.dataset.component === 'Repressor End');
                // connect first start to first end if neither is connected
                if (starts.length && ends.length) {
                    const startEl = starts[0];
                    const endEl = ends[0];
                    // check if already connected
                    const existing = J.getConnections({ source: startEl, target: endEl });
                    if (!existing || existing.length === 0) {
                        J.connect({ source: startEl, target: endEl, anchors: ['Right', 'Left'], connector: ['Bezier', { curviness: 50 }], paintStyle: { stroke: '#a78bfa', strokeWidth: 3 }, overlays: [['Arrow', { width: 10, length: 12, location: 1 }]] });
                    }
                }
            } catch (e) {
                // ignore auto-connect errors
                console.warn('Auto-connect failed', e);
            }
        }, 300);
    }

    // Lightweight SVG connector fallback (used when jsPlumb is not available)
    function setupSvgConnectors() {
        // create an SVG overlay that covers the page
        if (document.getElementById('svg-connector-overlay')) return; // idempotent

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', 'svg-connector-overlay');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '9999'; // ensure overlay is always above grid
        document.body.appendChild(svg);

        let dragState = null; // {sourceEl, pathEl}

        function screenCenter(el){
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width/2 + window.scrollX, y: r.top + r.height/2 + window.scrollY };
        }

        // helper to create a visible line
        function makeLine(x1,y1,x2,y2){
            const line = document.createElementNS('http://www.w3.org/2000/svg','path');
            const d = `M ${x1} ${y1} C ${x1+40} ${y1} ${x2-40} ${y2} ${x2} ${y2}`;
            line.setAttribute('d', d);
            line.setAttribute('stroke', '#a78bfa');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('fill', 'none');
            line.classList.add('svg-connector');
            line.style.zIndex = '9999'; // always above grid
            svg.appendChild(line);
            return line;
        }

        // mousemove while drawing
        function onMove(e){
            if (!dragState) return;
            const p = { x: e.pageX, y: e.pageY };
            const s = screenCenter(dragState.sourceEl);
            const d = `M ${s.x} ${s.y} C ${s.x+40} ${s.y} ${p.x-40} ${p.y} ${p.x} ${p.y}`;
            dragState.pathEl.setAttribute('d', d);
        }

        function onUp(e){
            if (!dragState) return;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);

            // detect target element under mouse
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const targetComp = el && (el.closest && el.closest('.component-node'));
            if (targetComp && targetComp.dataset && targetComp.dataset.component === 'Repressor End' && targetComp.closest('.grid-container')) {
                // Always remove any previous connector for this source-target pair
                state.placedConnections = state.placedConnections || [];
                state.placedConnections
                    .filter(c => c.source === dragState.sourceEl || c.target === targetComp)
                    .forEach(c => { if (c.path && c.path.parentNode) c.path.parentNode.removeChild(c.path); });
                state.placedConnections = state.placedConnections.filter(c => !(c.source === dragState.sourceEl || c.target === targetComp));

                // Draw new connector above cells
                const s = screenCenter(dragState.sourceEl);
                const t = screenCenter(targetComp);
                const final = makeLine(s.x, s.y, t.x, t.y);
                final.style.zIndex = '9999';
                final.dataset.source = dragState.sourceEl.dataset.component || '';
                final.dataset.target = targetComp.dataset.component || '';
                state.placedConnections.push({ source: dragState.sourceEl, target: targetComp, path: final });
            } else {
                // remove temp path
                if (dragState.pathEl && dragState.pathEl.parentNode) dragState.pathEl.parentNode.removeChild(dragState.pathEl);
            }

            dragState = null;
        }

        // attach pointerdown to connection handles (existing elements have .connection-handle or we create them)
        function attachToElement(el){
            if (el._svgConnectorAttached) return;
            el._svgConnectorAttached = true;

            // Only attach visible handles for repressor components
            // Only attach on placed board nodes inside grid
            if (!el.classList || !el.classList.contains('component-node')) return;
            if (!el.closest('.grid-container')) return;
            const compType = el.dataset && el.dataset.component;
            if (compType === 'Repressor Start') {
                // ensure there's a visible handle for the source (right side)
                let handle = el.querySelector('.connection-handle');
                if (!handle) {
                    handle = document.createElement('div');
                    handle.className = 'connection-handle connection-source';
                    el.appendChild(handle);
                }

                handle.style.pointerEvents = 'auto';
                handle.addEventListener('pointerdown', function(ev){
                    ev.preventDefault();
                    ev.stopPropagation();
                    // only start if this is a Repressor Start (defensive)
                    if (!el.dataset || el.dataset.component !== 'Repressor Start') return;
                    dragState = { sourceEl: el, pathEl: makeLine(0,0,0,0) };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            } else if (compType === 'Repressor End') {
                // ensure there's a visible handle for the target (visual only)
                let tHandle = el.querySelector('.connection-handle');
                if (!tHandle) {
                    tHandle = document.createElement('div');
                    tHandle.className = 'connection-handle connection-target';
                    el.appendChild(tHandle);
                }
                // target handle doesn't start drags; just allow pointer events so it can be styled
                tHandle.style.pointerEvents = 'auto';
            }
        }

        // allow programmatic start of a drag from code elsewhere
        function startDragOnElement(el) {
            if (!el || !el.dataset || el.dataset.component !== 'Repressor Start') return;
            dragState = { sourceEl: el, pathEl: makeLine(0,0,0,0) };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }

    // expose API for attaching svg handles to a single element
    try { window.__attachSvgHandle = attachToElement; } catch (e) { /* ignore */ }

        // initial attach only to placed board nodes
        document.querySelectorAll('.component-node').forEach(attachToElement);

        // watch for dynamic additions
        const obs = new MutationObserver((mutList) => {
            mutList.forEach(m => {
                if (m.addedNodes && m.addedNodes.length) {
                    m.addedNodes.forEach(n => {
                        if (n.nodeType === 1) {
                            if (n.matches && n.matches('.component-node')) attachToElement(n);
                            n.querySelectorAll && n.querySelectorAll('.component-node').forEach(attachToElement);
                        }
                    });
                }
            });
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // Setup the dial parameters enable/disable toggle
    function setupDialToggle() {
        const toggle = document.getElementById('enable_dial_params');
        const dialFormEl = document.getElementById('dial-form');
        if (!toggle || !dialFormEl) return;

        const container = dialFormEl.querySelector('.dial-accordion') || dialFormEl;
        const numberInputs = Array.from(dialFormEl.querySelectorAll('input[type="number"]'));

        const setDisabledState = (enabled) => {
            if (enabled) {
                container.classList.remove('dial-params-disabled');
                numberInputs.forEach(i => i.disabled = false);
            } else {
                container.classList.add('dial-params-disabled');
                numberInputs.forEach(i => i.disabled = true);
            }
        };

        // initialize
        setDisabledState(toggle.checked);

        toggle.addEventListener('change', function() {
            setDisabledState(this.checked);
        });
    }

    // Load hardware circuit data from localStorage if available
    function loadHardwareCircuitData() {
        const hardwareData = localStorage.getItem('hardwareCircuitData');
        
        if (hardwareData) {
            try {
                const circuitData = JSON.parse(hardwareData);
                const cellboard = circuitData.cellboard;
                
                if (cellboard && typeof cellboard === 'object') {
                    console.log('Loading hardware circuit data:', cellboard);
                    
                    // Show notification that hardware circuit is being loaded
                    showHardwareLoadNotification();
                    
                    // Convert cellboard format to designer format and place components
                    setTimeout(() => {
                        const placedCount = loadCellboardToDesigner(cellboard);
                        // localStorage is cleared inside loadCellboardToDesigner only on success
                        if (placedCount === 0) {
                            console.warn('No components were successfully placed from hardware data');
                            localStorage.removeItem('hardwareCircuitData'); // Clear if no placement succeeded
                        }
                    }, 500); // Small delay to allow UI to initialize
                }
            } catch (error) {
                console.error('Error loading hardware circuit data:', error);
                localStorage.removeItem('hardwareCircuitData'); // Clear corrupted data
            }
        }
    }
    
    // Show notification that hardware circuit is being loaded
    function showHardwareLoadNotification() {
        showNotification('Loading circuit from Cell Board...', 'success', 'microchip');
    }
    
    // Show error notification
    function showErrorNotification(message) {
        showNotification(message, 'error', 'exclamation-triangle');
    }
    
    // Generic notification function
    function showNotification(message, type = 'info', icon = 'info-circle') {
        const colors = {
            success: '#28a745',
            error: '#dc3545', 
            warning: '#ffc107',
            info: '#17a2b8'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 300px;
        `;
        notification.innerHTML = `<i class="fas fa-${icon} me-2"></i>${message}`;
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds for errors, 3 seconds for others
        const timeout = type === 'error' ? 4000 : 3000;
        setTimeout(() => {
            notification.remove();
        }, timeout);
    }
    
    // Clear all components without confirmation (for programmatic use)
    function clearAllComponents() {
        // Clear state
        state.placedComponents = [];
        
        // Clear visuals
        cells.forEach(cell => {
            removeComponentVisual(cell);
        });
        
        console.log('All components cleared programmatically');
    }
    
    // Test function to verify data transfer functionality
    window.testHardwareDataTransfer = function() {
        console.log('=== Testing Hardware Data Transfer ===');
        
        // Create mock cellboard data that simulates hardware output
        const mockCellboard = {
            'Promoter': [
                { gene: '1', strength: 'strong', x: '0', y: '0' },
                { gene: 'Gene 2', strength: 'norm', x: '2', y: '1' }
            ],
            'RBS': [
                { gene: '1', strength: 'norm', x: '1', y: '0' }
            ],
            'CDS': [
                { gene: '1', strength: 'weak', x: '2', y: '0' },
                { gene: '2', strength: 'strong', x: '3', y: '1' }
            ],
            'Terminator': [
                { gene: '1', strength: 'norm', x: '3', y: '0' }
            ]
        };
        
        console.log('1. Testing localStorage save/load format...');
        const testData = {
            cellboard: mockCellboard,
            timestamp: Date.now(),
            source: 'test_hardware'
        };
        
        // Test localStorage save
        localStorage.setItem('hardwareCircuitData', JSON.stringify(testData));
        console.log('✓ Data saved to localStorage');
        
        // Test data loading
        console.log('2. Testing loadCellboardToDesigner function...');
        const placedCount = loadCellboardToDesigner(mockCellboard);
        console.log(`✓ Placed ${placedCount} components`);
        
        // Test gene format handling
        console.log('3. Verifying gene format normalization...');
        state.placedComponents.forEach(comp => {
            console.log(`  Component: ${comp.type}, Gene: ${comp.gene}, Position: (${comp.x}, ${comp.y})`);
            if (!comp.gene.startsWith('Gene ')) {
                console.error(`✗ Gene format error: ${comp.gene} should start with 'Gene '`);
            } else {
                console.log(`  ✓ Gene format correct: ${comp.gene}`);
            }
        });
        
        // Test placement function usage
        console.log('4. Verifying placement integrity...');
        const cellsWithComponents = document.querySelectorAll('.cell.has-component');
        console.log(`  Visual components: ${cellsWithComponents.length}`);
        console.log(`  State components: ${state.placedComponents.length}`);
        
        if (cellsWithComponents.length === state.placedComponents.length) {
            console.log('  ✓ Visual and state components match');
        } else {
            console.error('  ✗ Mismatch between visual and state components');
        }
        
        // Test localStorage clearing after successful placement
        console.log('5. Testing localStorage cleanup...');
        const remainingData = localStorage.getItem('hardwareCircuitData');
        if (!remainingData) {
            console.log('  ✓ localStorage cleared after successful placement');
        } else {
            console.error('  ✗ localStorage not cleared properly');
        }
        
        console.log('=== Hardware Data Transfer Test Complete ===');
        return {
            placedCount,
            stateComponents: state.placedComponents.length,
            visualComponents: cellsWithComponents.length,
            localStorageCleared: !remainingData
        };
    };
    
    // Make test available globally for debugging
    window.debugDataTransfer = function() {
        console.log('Current state:', {
            placedComponents: state.placedComponents,
            currentComponent: state.currentComponent,
            currentGene: state.currentGene,
            currentStrength: state.currentStrength
        });
        
        console.log('Visual grid state:');
        document.querySelectorAll('.cell.has-component').forEach(cell => {
            console.log(`  Cell (${cell.dataset.x}, ${cell.dataset.y}): ${cell.textContent}`);
        });
    };
    
    // Convert cellboard format to designer format and place components
    function loadCellboardToDesigner(cellboard) {
        let successfulPlacements = 0;
        let totalComponents = 0;
        
        // Clear existing components first
        clearAllComponents();
        
        // Mapping of cellboard component types to designer component types
        const componentTypeMap = {
            'Promoter': 'Promoter',
            'RBS': 'RBS', 
            'CDS': 'CDS',
            'Terminator': 'Terminator',
            'Repressor Start': 'Repressor Start',
            'Repressor End': 'Repressor End',
            'Activator Start': 'Activator Start',
            'Activator End': 'Activator End',
            'Inducer': 'Inducer'
        };
        
        try {
            // Process each component type from cellboard
            Object.entries(cellboard).forEach(([componentType, componentList]) => {
                if (Array.isArray(componentList)) {
                    componentList.forEach(comp => {
                        totalComponents++;
                        const designerType = componentTypeMap[componentType];
                        if (designerType) {
                            // Find the cell at the specified position
                            const cell = document.querySelector(`[data-x="${comp.x}"][data-y="${comp.y}"]`);
                            if (cell && cell.classList.contains('functional')) {
                                // Normalize gene format - ensure it's "Gene X" format
                                let geneIdentifier;
                                if (comp.gene && comp.gene.startsWith('Gene ')) {
                                    geneIdentifier = comp.gene; // Already in correct format
                                } else if (comp.gene && /^\d+$/.test(comp.gene.toString())) {
                                    geneIdentifier = `Gene ${comp.gene}`; // Convert "1" to "Gene 1"
                                } else {
                                    geneIdentifier = 'Gene 1'; // Default fallback
                                }
                                
                                // Set up state for placement
                                state.currentComponent = designerType;
                                state.currentGene = geneIdentifier.split(' ')[1]; // Extract number part
                                state.currentStrength = comp.strength || 'norm';
                                
                                // Use proper placement function to maintain invariants
                                placeComponent(cell);
                                successfulPlacements++;
                                
                                console.log('Placed hardware component:', {
                                    type: designerType,
                                    gene: geneIdentifier,
                                    strength: comp.strength || 'norm',
                                    x: comp.x,
                                    y: comp.y
                                });
                            } else {
                                console.warn(`Cannot place component at (${comp.x}, ${comp.y}): cell not found or not functional`);
                            }
                        } else {
                            console.warn(`Unknown component type: ${componentType}`);
                        }
                    });
                }
            });
            
            console.log(`Successfully loaded ${successfulPlacements}/${totalComponents} components from Cell Board`);
            
            // Only clear localStorage after successful placement
            if (successfulPlacements > 0) {
                localStorage.removeItem('hardwareCircuitData');
                console.log('Hardware circuit data cleared from localStorage after successful transfer');
            }
            
            // After placement, ensure UI reflects number of genes found
            try {
                const maxGene = state.placedComponents.reduce((max, c) => {
                    const n = parseInt((c.gene || 'Gene 1').toString().split(' ')[1]) || 1;
                    return Math.max(max, n);
                }, 1);
                ensureGenesUI(maxGene);
                ensureGeneParameterSections(maxGene);
            } catch (e) {
                console.warn('Error ensuring dynamic gene UI:', e);
            }

            return successfulPlacements;
            
        } catch (error) {
            console.error('Error loading hardware circuit data:', error);
            showErrorNotification('Failed to load some components from Cell Board');
            return successfulPlacements;
        }
    }

    // Create or reveal gene tabs and panels up to maxGene
    function ensureGenesUI(maxGene) {
        const tabsContainer = document.getElementById('gene-tabs');
        const componentsContainer = document.getElementById('gene-components');
        if (!tabsContainer || !componentsContainer) return;

        // find the template panel to clone (prefer the one with class template)
        const templatePanel = componentsContainer.querySelector('.gene-panel.template') || componentsContainer.querySelector('.gene-panel');
    for (let i = 1; i <= maxGene; i++) {
            // Create tab if missing
            if (!tabsContainer.querySelector(`.gene-tab[data-gene="${i}"]`)) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'gene-tab';
                if (i === 1) btn.classList.add('active');
                btn.dataset.gene = String(i);
                btn.setAttribute('role', 'tab');
                btn.setAttribute('aria-selected', i === 1 ? 'true' : 'false');
                btn.textContent = `Gene ${i}`;
                // attach a direct handler so newly-created tabs work even if delegation missed
                btn.addEventListener('click', function(e) {
                    activateGeneTab(this);
                });
                tabsContainer.appendChild(btn);
            }

            // Create panel if missing
            if (!componentsContainer.querySelector(`.gene-panel[data-gene="${i}"]`)) {
                if (!templatePanel) continue;
                const clone = templatePanel.cloneNode(true);
                clone.classList.remove('template');
                // remove any 'active' class unless it's gene 1
                clone.classList.toggle('active', i === 1);
                clone.dataset.gene = String(i);
                // update internal components' data-gene attributes
                clone.querySelectorAll('.component').forEach(comp => {
                    comp.dataset.gene = String(i);
                    // update inner markup if any references to gene present (not common)
                });
                componentsContainer.appendChild(clone);
            }
        }

        // Re-attach gene tab handlers
        setupGeneTabs();
        // Re-attach component handlers for any newly cloned components
        setupComponents();
        // Update tab density (compact mode) when many genes exist
        updateGeneTabDensity();
    }

    // Helper to activate a gene tab element
    function activateGeneTab(tab) {
        if (!tab) return;
        // Deactivate all tabs and panels (also unset aria-selected)
            deactivateAllTabsAndPanels();
            activateTargetTab(tab);
        }

        function deactivateAllTabsAndPanels() {
            document.querySelectorAll('.gene-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
            document.querySelectorAll('.gene-panel').forEach(p => p.classList.remove('active'));
        }

        function activateTargetTab(tab) {
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const gene = tab.dataset.gene;
            state.currentGene = gene;
            const targetPanel = document.querySelector(`.gene-panel[data-gene="${gene}"]`);
            if (targetPanel) targetPanel.classList.add('active');
    }

    // Add gene button wiring
    function setupAddGeneButton() {
        const addBtn = document.getElementById('add-gene-btn');
        if (!addBtn) return;
        addBtn.addEventListener('click', function() {
            // determine current highest gene
            const existingTabs = Array.from(document.querySelectorAll('.gene-tab')).map(b => parseInt(b.dataset.gene || '1'));
            const max = existingTabs.length ? Math.max(...existingTabs) : 1;
            const next = max + 1;
            ensureGenesUI(next);
            ensureGeneParameterSections(next);
            // activate the new tab
            const newTab = document.querySelector(`.gene-tab[data-gene="${next}"]`);
            if (newTab) {
                // dispatch a bubbling click so delegated listener handles it reliably
                newTab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                // smooth scroll so the tab is visible when many tabs exist
                try { newTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (e) {}
                // adjust tab density after adding
                updateGeneTabDensity();
            }
        });
    }

    // Remove gene button wiring
    function setupRemoveGeneButton() {
        const removeBtn = document.getElementById('remove-gene-btn');
        if (!removeBtn) return;
        removeBtn.addEventListener('click', function() {
            // Find highest gene number
            const tabs = Array.from(document.querySelectorAll('.gene-tab')).map(b => parseInt(b.dataset.gene || '1')).filter(n => !isNaN(n));
            if (tabs.length <= 1) return; // nothing to remove (keep gene 1)
            const max = Math.max(...tabs);
            if (max <= 1) return;

            // Remove UI: tab, panel, and parameter section
            const tab = document.querySelector(`.gene-tab[data-gene="${max}"]`);
            const panel = document.querySelector(`.gene-panel[data-gene="${max}"]`);
            const paramSummary = Array.from(document.querySelectorAll('.dial-accordion-item')).find(det => {
                const s = det.querySelector('.dial-accordion-header');
                return s && s.textContent.trim().match(new RegExp(`Gene\\s*${max}`));
            });

            // Reassign placed components for this gene to Gene 1 to avoid losing them
            state.placedComponents.forEach(c => {
                const geneNum = parseInt((c.gene || 'Gene 1').split(' ')[1]) || 1;
                if (geneNum === max) {
                    c.gene = 'Gene 1';
                }
            });

            // Update visuals on board where necessary
            document.querySelectorAll('.cell.has-component').forEach(cell => {
                const text = (cell.textContent || '').trim();
                const m = text.match(/^(\d+):/);
                if (m && parseInt(m[1]) === max) {
                    // change displayed gene number to 1
                    const rest = text.replace(/^\d+:/, '1:');
                    cell.firstChild && (cell.firstChild.textContent = rest);
                    cell.textContent = rest; // simpler approach
                }
            });

            if (tab) tab.remove();
            if (panel) panel.remove();
            if (paramSummary) paramSummary.remove();

            // Activate the previous highest tab
            const remaining = Array.from(document.querySelectorAll('.gene-tab')).map(b => parseInt(b.dataset.gene || '1'));
            const newMax = remaining.length ? Math.max(...remaining) : 1;
            const newTab = document.querySelector(`.gene-tab[data-gene="${newMax}"]`);
            if (newTab) activateGeneTab(newTab);
            // update compact/normal density after removal
            updateGeneTabDensity();
        });
    }

    // Reduce tab padding/min-width when many genes are present so layout doesn't expand
    function updateGeneTabDensity() {
        const wrapper = document.querySelector('.gene-tabs-wrapper');
        if (!wrapper) return;
        const tabCount = document.querySelectorAll('.gene-tab').length;
        // Toggle a class that makes tabs more compact when there are many of them
        if (tabCount > 10) {
            wrapper.classList.add('many-genes');
        } else {
            wrapper.classList.remove('many-genes');
        }
    }

    // Add parameter sections (accordion details) for genes beyond the static ones
    function ensureGeneParameterSections(maxGene) {
        const dialFormEl = document.getElementById('dial-form');
        if (!dialFormEl) return;
        const accordion = dialFormEl.querySelector('.dial-accordion');
        if (!accordion) return;

        // Helper to create a details block for a gene
        function createGeneDetails(n) {
            const d = document.createElement('details');
            d.className = 'dial-accordion-item';
            const s = document.createElement('summary');
            s.className = 'dial-accordion-header';
            s.textContent = `Gene ${n} Components`;
            d.appendChild(s);

            const body = document.createElement('div');
            body.className = 'dial-accordion-body';
            const grid = document.createElement('div');
            grid.className = 'dial-grid';

            const fields = [
                ['Promoter Strength', `promoter${n}_strength`, '1.0', '0.1', '5.0', '0.1'],
                ['RBS Efficiency', `rbs${n}_efficiency`, '1.0', '0.1', '2.0', '0.1'],
                ['CDS Translation Rate', `cds${n}_translation_rate`, '5.0', '1.0', '20.0', '0.5'],
                ['CDS Degradation Rate', `cds${n}_degradation_rate`, '0.1', '0.01', '1.0', '0.01'],
                ['Terminator Eff', `terminator${n}_efficiency`, '0.99', '0.1', '1.0', '0.01'],
                ['Initial Protein Conc', `protein${n}_initial_conc`, '0.1', '0.0', '2.0', '0.05']
            ];

            fields.forEach(([label, name, value, min, max, step]) => {
                const lab = document.createElement('label');
                lab.setAttribute('for', name);
                lab.textContent = label + ':';
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.id = name;
                inp.name = name;
                inp.value = value;
                inp.min = min;
                inp.max = max;
                inp.step = step;
                grid.appendChild(lab);
                grid.appendChild(inp);
            });

            body.appendChild(grid);
            d.appendChild(body);
            return d;
        }

        // Determine existing gene detail numbers
        const existing = Array.from(accordion.querySelectorAll('.dial-accordion-item')).map(det => {
            const summary = det.querySelector('.dial-accordion-header');
            if (!summary) return 0;
            const m = summary.textContent.match(/Gene\s*(\d+)/i);
            return m ? parseInt(m[1]) : 0;
        }).filter(n => n > 0);
        const maxExisting = existing.length ? Math.max(...existing) : 1;

        for (let i = 1; i <= maxGene; i++) {
            if (i <= maxExisting) continue; // already present
            const details = createGeneDetails(i);
            accordion.appendChild(details);
        }
    }

    // Gene tab functionality
    function setupGeneTabs() {
        const tabsContainer = document.getElementById('gene-tabs');
        if (!tabsContainer) return;
        if (tabsContainer._geneListenerAttached) return; // idempotent

        tabsContainer.addEventListener('click', function(e) {
            const tab = e.target.closest('.gene-tab');
            if (!tab || !tabsContainer.contains(tab)) return;

            // Deactivate all tabs and panels
            document.querySelectorAll('.gene-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.gene-panel').forEach(p => p.classList.remove('active'));

            // Activate clicked tab
            tab.classList.add('active');
            const gene = tab.dataset.gene;
            state.currentGene = gene;

            const targetPanel = document.querySelector(`.gene-panel[data-gene="${gene}"]`);
            if (targetPanel) targetPanel.classList.add('active');
        });

        tabsContainer._geneListenerAttached = true;
    }

    // Component selection and strength menu
    function setupComponents() {
        // Re-query components live so newly cloned panels are included
        const liveComponents = document.querySelectorAll('.component');
        liveComponents.forEach(comp => {
            if (comp._setupDone) return; // avoid double-binding
            comp._setupDone = true;
            // Make components draggable
            comp.setAttribute('draggable', 'true');
            
            // Component click for selection and strength menu
            comp.addEventListener('click', function(e) {
                e.stopPropagation();
                state.currentComponent = this.dataset.component;
                state.currentGene = this.dataset.gene;
                
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
        // update the global components NodeList reference for other functions
        // (optional) but keep original variable to avoid undefined elsewhere
        // components = document.querySelectorAll('.component'); // don't overwrite const
    }

    // Cell interactions
    function setupCells() {
        cells.forEach(cell => {
            // Click to place component
            cell.addEventListener('click', function() {
                if (this.classList.contains('functional') && state.currentComponent) {
                    placeComponent(this);
                }
            });

            // Right-click to remove component
            cell.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                if (this.classList.contains('has-component')) {
                    removeComponent(this);
                }
            });
        });
    }

    // Setup drag and drop functionality
    function setupDragAndDrop() {
        // Dragstart for components
        components.forEach(comp => {
            comp.addEventListener('dragstart', function(e) {
                state.isDragging = true;
                state.draggedElement = this;
                state.currentComponent = this.dataset.component;
                state.currentGene = this.dataset.gene;
                
                // Set drag image
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    component: this.dataset.component,
                    gene: this.dataset.gene
                }));
                
                // Visual feedback
                this.style.opacity = '0.5';
            });

            comp.addEventListener('dragend', function() {
                state.isDragging = false;
                state.draggedElement = null;
                this.style.opacity = '';
            });
        });

        // Drop zones (cells)
        cells.forEach(cell => {
            if (cell.classList.contains('functional')) {
                cell.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    this.style.backgroundColor = 'rgba(0, 156, 77, 0.2)';
                    this.style.borderColor = 'var(--primary)';
                });

                cell.addEventListener('dragleave', function() {
                    this.style.backgroundColor = '';
                    this.style.borderColor = '';
                });

                cell.addEventListener('drop', function(e) {
                    e.preventDefault();
                    this.style.backgroundColor = '';
                    this.style.borderColor = '';
                    
                    if (state.currentComponent) {
                        placeComponent(this);
                    }
                });
            }
        });
    }

    // Button event handlers
    function setupButtons() {
        if (simulateBtn) {
            simulateBtn.addEventListener('click', runSimulation);
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', clearBoard);
        }

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportProject);
        }

        if (helpBtn) {
            helpBtn.addEventListener('click', showHelp);
        }

        // Close strength menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.component') && !e.target.closest('.strength-menu')) {
                document.querySelectorAll('.strength-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        });
    }

    // Place component on board
    function placeComponent(cell) {
        if (!state.currentComponent) return;

        const x = cell.dataset.x;
        const y = cell.dataset.y;

        // Remove existing component from this cell
        const existingIndex = state.placedComponents.findIndex(c => c.x === x && c.y === y);
        if (existingIndex >= 0) {
            state.placedComponents.splice(existingIndex, 1);
            removeComponentVisual(cell);
        }

        // Create new component
        const component = {
            type: state.currentComponent,
            gene: `Gene ${state.currentGene}`,
            strength: state.currentStrength,
            x: x,
            y: y,
            id: `${state.currentComponent}_${x}_${y}`
        };

        state.placedComponents.push(component);
        updateCellVisual(cell, component);

        // Animation feedback
        cell.classList.add('placed');
        setTimeout(() => {
            cell.classList.remove('placed');
        }, 300);

        console.log('Component placed:', component);
        console.log('Total components:', state.placedComponents.length);
    }

    // Remove component from board
    function removeComponent(cell) {
        const x = cell.dataset.x;
        const y = cell.dataset.y;

        const index = state.placedComponents.findIndex(c => c.x === x && c.y === y);
        if (index >= 0) {
            state.placedComponents.splice(index, 1);
            removeComponentVisual(cell);
            console.log('Component removed from:', x, y);
        }
    }

    // Update cell visual appearance
    function updateCellVisual(cell, component) {
        const colors = {
            'Promoter': '#FF6B6B',
            'Terminator': '#4ECDC4',
            'RBS': '#FFD166',
            'CDS': '#06D6A0',
            'Repressor Start': '#A78BFA',
            'Repressor End': '#7E22CE',
            'Activator Start': '#3B82F6',
            'Activator End': '#1E40AF',
            'Inducer': '#FF69B4'
        };

        // Clear existing content
        cell.innerHTML = '';
        
        // Set visual properties
        cell.style.backgroundColor = colors[component.type] || '#999';
        cell.style.color = 'white';
        cell.style.fontWeight = '600';
        cell.classList.add('has-component');

        // Mark cell as a node for jsPlumb
        cell.classList.add('component-node');
        cell.dataset.component = component.type;
        cell.dataset.gene = component.gene;

        // Notify connector systems (jsPlumb or SVG fallback) to attach endpoints/handles
        // do this in next tick so the DOM is stable and mutation observers have processed
        setTimeout(() => {
            if (typeof window.__attachJsPlumbEndpoint === 'function') {
                try { window.__attachJsPlumbEndpoint(cell); } catch (e) { /* ignore */ }
            }
            if (typeof window.__attachSvgHandle === 'function') {
                try { window.__attachSvgHandle(cell); } catch (e) { /* ignore */ }
            }
        }, 0);

        // Create component display
        const geneNum = component.gene.split(' ')[1];
        const compAbbr = getComponentAbbreviation(component.type);
        cell.textContent = `${geneNum}:${compAbbr}`;

        // Add strength indicator
        const strengthDot = document.createElement('div');
        strengthDot.className = `strength-dot strength-${component.strength}`;
        strengthDot.style.backgroundColor = getStrengthColor(component.strength);
        cell.appendChild(strengthDot);
    }

    // Remove component visual
    function removeComponentVisual(cell) {
        cell.style.backgroundColor = '';
        cell.style.color = '';
        cell.style.fontWeight = '';
        cell.textContent = '';
        cell.classList.remove('has-component');
        
        // Remove jsPlumb marker and attributes
        cell.classList.remove('component-node');
        delete cell.dataset.component;
        delete cell.dataset.gene;

        const dot = cell.querySelector('.strength-dot');
        if (dot) {
            dot.remove();
        }
    }

    // Get component abbreviation
    function getComponentAbbreviation(type) {
        const abbreviations = {
            'Promoter': 'P',
            'Terminator': 'T',
            'RBS': 'R',
            'CDS': 'C',
            'Repressor Start': 'Rs',
            'Repressor End': 'Re',
            'Activator Start': 'As',
            'Activator End': 'Ae',
            'Inducer': 'I'
        };
        return abbreviations[type] || type.charAt(0);
    }

    // Get strength color
    function getStrengthColor(strength) {
        const colors = {
            'weak': '#fca5a5',
            'norm': '#fcd34d',
            'strong': '#86efac'
        };
        return colors[strength] || '#fcd34d';
    }

    // Run simulation
    async function runSimulation() {
        if (!simulateBtn) return;

        // Disable button and show loading
        simulateBtn.disabled = true;
        simulateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Running...';
        
        // Clear previous errors
        if (errorDisplay) {
            errorDisplay.style.display = 'none';
            errorDisplay.textContent = '';
        }

        // Show loading in plot container
        if (plotContainer) {
            plotContainer.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Simulating genetic circuit dynamics...</p>
                </div>
            `;
        }

        try {
            // Check if components are placed
            if (state.placedComponents.length === 0) {
                throw new Error('No components placed on the board. Please place some components first.');
            }

            // Prepare cellboard data
            const cellboard = state.placedComponents.reduce((acc, comp) => {
                if (!acc[comp.type]) {
                    acc[comp.type] = [];
                }
                acc[comp.type].push({
                    gene: comp.gene,
                    strength: comp.strength,
                    x: comp.x,
                    y: comp.y
                });
                return acc;
            }, {});

            // Prepare request data
            const requestData = { cellboard: cellboard };

            // Add dial data if in dial mode AND the user enabled parameter overrides
            if (dialForm) {
                const toggle = document.getElementById('enable_dial_params');
                const includeDial = toggle ? toggle.checked : true;
                // Tell server explicitly whether to apply dial overrides
                requestData.apply_dial = !!includeDial;
                if (includeDial) {
                    const dialData = {};
                    // only gather enabled inputs (disabled inputs are ignored)
                    const inputs = dialForm.querySelectorAll('input[type="number"]:not([disabled])');
                    inputs.forEach(input => {
                        dialData[input.name] = parseFloat(input.value) || 0;
                    });
                    requestData.dial = dialData;
                }
                // if includeDial is false, we explicitly set apply_dial=false and omit dial
            }

            // Debug: show whether dial overrides will be applied and the full payload
            console.log('Sending simulation request. apply_dial:', requestData.apply_dial, 'payload:', requestData);

            // Send simulation request
            const response = await fetch('/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }

            const result = await response.json();
            console.log('Simulation result:', result);

            if (result.status === 'success') {
                // Display results
                if (result.plot && plotContainer) {
                    plotContainer.innerHTML = `
                        <img src="data:image/png;base64,${result.plot}" 
                             alt="Simulation Results" 
                             class="plot-image">
                    `;
                } else if (plotContainer) {
                    plotContainer.innerHTML = '<p class="text-center">Simulation completed successfully</p>';
                }

                // Add animation
                if (plotContainer) {
                    plotContainer.classList.add('placed');
                    setTimeout(() => {
                        plotContainer.classList.remove('placed');
                    }, 300);
                }

                // Populate ontology analysis
                populateOntologyAnalysis(result);
                
                // Log detailed results
                if (result.circuits) {
                    console.log('Detected circuits:', result.circuits);
                }
                if (result.regulations) {
                    console.log('Regulatory networks:', result.regulations);
                }
                if (result.warnings && result.warnings.length > 0) {
                    console.warn('Simulation warnings:', result.warnings);
                }

            } else {
                throw new Error(result.message || 'Unknown simulation error');
            }

        } catch (error) {
            console.error('Simulation failed:', error);
            
            // Display error
            if (errorDisplay) {
                errorDisplay.textContent = `Error: ${error.message}`;
                errorDisplay.style.display = 'block';
            }

            // Show error in plot container
            if (plotContainer) {
                plotContainer.innerHTML = `
                    <div class="loading">
                        <i class="fas fa-exclamation-triangle" style="color: var(--error); font-size: 2rem;"></i>
                        <p>Simulation failed</p>
                        <small class="text-muted">${error.message}</small>
                    </div>
                `;
            }

        } finally {
            // Re-enable button
            simulateBtn.disabled = false;
            simulateBtn.innerHTML = '<i class="fas fa-play me-2"></i>Run Simulation';
        }
    }

    // Clear board
    function clearBoard() {
        if (state.placedComponents.length === 0) return;

        if (confirm('Are you sure you want to clear the design board?')) {
            // Clear state
            state.placedComponents = [];

            // Clear visuals
            cells.forEach(cell => {
                removeComponentVisual(cell);
            });

            // Reset plot container
            if (plotContainer) {
                plotContainer.innerHTML = `
                    <div class="loading">
                        <i class="fas fa-dna" style="color: var(--primary); font-size: 2rem;"></i>
                        <p>Design your circuit and run simulation</p>
                    </div>
                `;
            }

            // Clear errors
            if (errorDisplay) {
                errorDisplay.style.display = 'none';
            }

            console.log('Board cleared');
        }
    }

    // Show help
    function showHelp() {
        const helpText = `
How to use the Genetic Circuit Designer:

1. Select a gene tab (1, 2, or 3)
2. Click a component to select it
3. Click the component again to choose strength (weak/normal/strong)
4. Drag or click to place components on the board
5. Right-click on placed components to remove them
6. Use the Run Simulation button to analyze your circuit
7. Check the results for circuit dynamics and warnings

Components:
• Promoter: Initiates transcription
• RBS: Ribosome binding site for translation
• CDS: Coding sequence (protein output)
• Terminator: Stops transcription
• Repressor Start/End: Inhibits expression
• Activator Start/End: Enhances expression

Tips:
• Place components in logical order (Promoter → RBS → CDS → Terminator)
• Use regulatory elements to create complex networks
• Experiment with different strengths for varied dynamics
        `;
        
        alert(helpText);
    }

    // Ontology Analysis Population
    function populateOntologyAnalysis(result) {
        const analysisSection = document.getElementById('ontology-analysis');
        
        if (!analysisSection) return;
        
        // Show the analysis section
        analysisSection.style.display = 'block';
        
        const circuits = result.circuits || [];
        const regulations = result.regulations || [];
        const warnings = result.warnings || [];
        const errors = result.errors || [];
        
        // Calculate metrics
        const validCircuits = circuits.filter(c => c.components && c.components.length > 0 && (!c.fallback_by_cds || Object.keys(c.fallback_by_cds).length === 0));
        const incompleteCircuits = circuits.filter(c => c.fallback_by_cds && Object.keys(c.fallback_by_cds).length > 0);
        const extraComponents = circuits.reduce((acc, c) => acc + (c.extras ? c.extras.length : 0), 0);
        const regulatoryLinks = regulations.length;
        const unpairedRegs = result.unpaired_regulators || [];
        
        // Update status overview
        updateStatusOverview(validCircuits.length, incompleteCircuits.length, extraComponents, regulatoryLinks);
        
        // Populate detailed sections
        populateValidCircuits(validCircuits);
        populateIncompleteCircuits(circuits);
        populateUnpairedRegulators(unpairedRegs);
        populateRegulatoryNetworks(regulations);
        populateEquationDisplay(result);
        populateCircuitIssues(warnings, errors);
        populateExtraComponents(circuits);
        populateComponentAnalysis(circuits);
        
        // Add animation
        analysisSection.classList.add('placed');
        setTimeout(() => {
            analysisSection.classList.remove('placed');
        }, 300);
    }
    
    function updateStatusOverview(valid, incomplete, extra, regulatory) {
        document.getElementById('valid-circuits').textContent = valid;
        document.getElementById('incomplete-circuits').textContent = incomplete;
        document.getElementById('extra-components').textContent = extra;
        document.getElementById('regulatory-links').textContent = regulatory;
    }
    
    function populateIncompleteCircuits(circuits) {
        const container = document.getElementById('incomplete-circuits-list');
        
        // Filter for circuits with fallbacks
        const incompleteCircuits = circuits.filter(circuit => circuit.fallback_by_cds && Object.keys(circuit.fallback_by_cds).length > 0);
        
        if (incompleteCircuits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle text-muted"></i>
                    <p>No incomplete circuits found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = incompleteCircuits.map(circuit => `
            <div class="circuit-item incomplete">
                <h5>${circuit.name || 'Circuit'} <span class="badge bg-warning">Incomplete</span></h5>
                <div class="circuit-meta">
                    <span>Components: ${circuit.components.length}</span>
                    <span>CDS: ${circuit.component_counts?.cds || 0}</span>
                    <span>Missing Parts: ${Object.keys(circuit.fallback_by_cds).length}</span>
                </div>
                <div class="fallback-details">
                    <h6>Missing Components by CDS:</h6>
                    ${Object.entries(circuit.fallback_by_cds).map(([cds, fallbacks]) => `
                        <div class="fallback-item">
                            <strong>${cds}:</strong>
                            ${Object.entries(fallbacks).filter(([key, val]) => key.startsWith('missing_') && val).map(([key, val]) => {
                                const part = key.replace('missing_', '');
                                return `<span class="missing-part">${part}</span>`;
                            }).join(', ')}
                            ${(() => {
                                const showAdjusted = document.getElementById('enable_dial_params')?.checked;
                                if (!showAdjusted) return '';
                                return `${fallbacks.prom_strength !== undefined ? 
                                    `<small class="text-muted">(promoter strength adjusted to ${fallbacks.prom_strength})</small>` : ''}
                                ${fallbacks.rbs_efficiency !== undefined ? 
                                    `<small class="text-muted">(RBS efficiency adjusted to ${fallbacks.rbs_efficiency})</small>` : ''}
                                ${fallbacks.degradation_rate !== undefined ? 
                                    `<small class="text-muted">(degradation adjusted to ${fallbacks.degradation_rate})</small>` : ''}`;
                            })()}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
    
    function populateUnpairedRegulators(unpaired) {
        const container = document.getElementById('unpaired-regulators-list');
        
        if (!unpaired || unpaired.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-link text-muted"></i>
                    <p>All regulators are properly paired</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = unpaired.map(reg => `
            <div class="regulator-item unpaired">
                <h5>${reg.label} <span class="badge bg-danger">Unpaired</span></h5>
                <div class="regulator-issue">
                    <strong>Issue:</strong> ${reg.issue}
                </div>
                <div class="regulator-hint">
                    <strong>Solution:</strong> ${reg.hint}
                </div>
            </div>
        `).join('');
    }
    
    function populateValidCircuits(circuits) {
        const container = document.getElementById('valid-circuits-list');
        
        // Filter for complete circuits (no fallbacks)
        const completeCircuits = circuits.filter(circuit => !circuit.fallback_by_cds || Object.keys(circuit.fallback_by_cds).length === 0);
        
        if (completeCircuits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-dna text-muted"></i>
                    <p>No complete circuits detected yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = completeCircuits.map(circuit => `
            <div class="circuit-item">
                <h5>${circuit.name || 'Circuit'}</h5>
                <div class="circuit-meta">
                    <span>Components: ${circuit.components.length}</span>
                    <span>CDS: ${circuit.component_counts?.cds || 0}</span>
                    <span>Promoters: ${circuit.component_counts?.promoter || 0}</span>
                </div>
                <div class="circuit-description">
                    ${generateCircuitDescription(circuit)}
                </div>
                <div class="component-badges">
                    ${circuit.components.map(comp => 
                        `<span class="component-badge ${comp.type}">${comp.type}</span>`
                    ).join('')}
                </div>
            </div>
        `).join('');
    }
    
    function populateRegulatoryNetworks(regulations) {
        const container = document.getElementById('regulations-list');
        
        if (regulations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-project-diagram text-muted"></i>
                    <p>No regulatory networks found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = regulations.map(reg => `
            <div class="regulation-item">
                <h5>${reg.type.toUpperCase()} Regulation</h5>
                <div class="regulation-meta">
                    <span>Source: ${reg.source || 'Constitutive'}</span>
                    <span>Target: ${reg.target}</span>
                </div>
                <div class="regulation-description">
                    ${generateRegulationDescription(reg)}
                </div>
            </div>
        `).join('');
    }
    
    function populateCircuitIssues(warnings, errors) {
        const container = document.getElementById('circuit-issues');
        const issues = [...warnings.map(w => ({type: 'warning', message: w})), 
                       ...errors.map(e => ({type: 'error', message: e}))];
        
        if (issues.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shield-alt text-muted"></i>
                    <p>No issues detected</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = issues.map(issue => `
            <div class="issue-item">
                <h5>
                    <span class="issue-severity ${issue.type}">${issue.type.toUpperCase()}</span>
                    Circuit Issue
                </h5>
                <div class="issue-description">
                    ${issue.message}
                </div>
            </div>
        `).join('');
    }
    
    function populateExtraComponents(circuits) {
        const container = document.getElementById('extra-components-list');
        const allExtras = circuits.reduce((acc, c) => [...acc, ...(c.extras || [])], []);
        
        if (allExtras.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-puzzle-piece text-muted"></i>
                    <p>All components are properly assigned</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = allExtras.map(extra => `
            <div class="extra-item">
                <h5>Extra ${extra.type.toUpperCase()}</h5>
                <div class="extra-meta">
                    <span>Name: ${extra.name}</span>
                    <span>ID: ${extra.id}</span>
                </div>
                <div class="extra-description">
                    <strong>Reason:</strong> ${extra.reason || 'Component exceeds expected count'}
                </div>
            </div>
        `).join('');
    }
    
    function populateComponentAnalysis(circuits) {
        const container = document.getElementById('component-analysis');
        
        if (circuits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cube text-muted"></i>
                    <p>Place components to see detailed analysis</p>
                </div>
            `;
            return;
        }
        
        const componentStats = calculateComponentStats(circuits);
        
        container.innerHTML = `
            <div class="row">
                ${Object.entries(componentStats).map(([type, stats]) => `
                    <div class="col-md-6 mb-3">
                        <div class="component-item">
                            <h5>${capitalizeComponentType(type)} Components</h5>
                            <div class="component-meta">
                                <span>Count: ${stats.count}</span>
                                <span>Average Strength: ${stats.avgStrength}</span>
                            </div>
                            <div class="component-description">
                                ${generateComponentStatsDescription(type, stats)}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    function generateCircuitDescription(circuit) {
        const compCounts = circuit.component_counts || {};
        const hasRegulators = (compCounts.repressor || 0) + (compCounts.activator || 0) > 0;
        
        if (compCounts.cds > 0 && compCounts.promoter > 0) {
            return `Complete functional circuit with ${compCounts.cds} CDS protein(s) under ${compCounts.promoter} Promoter(s)${hasRegulators ? ' with regulatory control' : ''}.`;
        } else {
            return 'Incomplete circuit missing essential components for protein expression.';
        }
    }
    
    function generateRegulationDescription(reg) {
        if (reg.type === 'constitutive') {
            return `Constitutive expression with basal rate of ${reg.parameters?.basal_rate || 'default'}.`;
        } else {
            return `${reg.type.charAt(0).toUpperCase() + reg.type.slice(1)} regulation affecting ${reg.affected_cdss?.length || 0} protein(s).`;
        }
    }
    
    function capitalizeComponentType(type) {
        const capitalizations = {
            'promoter': 'Promoter',
            'rbs': 'RBS', 
            'cds': 'CDS',
            'terminator': 'Terminator',
            'regulator': 'Regulator',
            'activator': 'Activator',
            'repressor': 'Repressor',
            'operator': 'Operator'
        };
        return capitalizations[type.toLowerCase()] || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }
    
    function generateComponentStatsDescription(type, stats) {
        const descriptions = {
            'promoter': `Initiating gene expression with average strength ${stats.avgStrength}`,
            'rbs': `Translation efficiency averaging ${stats.avgStrength} strength`,
            'cds': `Protein coding sequences with ${stats.avgStrength} expression level`,
            'terminator': `Transcription termination with ${stats.avgStrength} efficiency`,
            'regulator': `Regulatory elements for circuit control`
        };
        return descriptions[type.toLowerCase()] || `${capitalizeComponentType(type)} components in the circuit`;
    }
    
    function calculateComponentStats(circuits) {
        const stats = {};
        
        circuits.forEach(circuit => {
            circuit.components.forEach(comp => {
                if (!stats[comp.type]) {
                    stats[comp.type] = { count: 0, totalStrength: 0, strengths: [] };
                }
                
                stats[comp.type].count++;
                
                // Try to extract strength from component parameters
                const strength = comp.parameters?.strength || 1;
                stats[comp.type].totalStrength += strength;
                stats[comp.type].strengths.push(strength);
            });
        });
        
        // Calculate averages
        Object.keys(stats).forEach(type => {
            const typeStats = stats[type];
            typeStats.avgStrength = (typeStats.totalStrength / typeStats.count).toFixed(2);
        });
        
        return stats;
    }

    function populateEquationDisplay(result) {
        const container = document.getElementById('equation-display-list');
        if (!container) return;
        
        const equations = result.equations || {};
        const proteinMapping = result.protein_mapping || {};
        
        if (Object.keys(equations).length === 0) {
            container.innerHTML = '<div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>No protein equations generated</div>';
            return;
        }
        
        let html = '';
        
        // Add MathJax configuration if not already loaded
        if (typeof MathJax === 'undefined') {
            html += `
                <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
                <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
                <script>
                window.MathJax = {
                    tex: {
                        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
                    }
                };
                </script>
            `;
        }
        
        Object.entries(equations).forEach(([protein, eq]) => {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0">
                            <i class="fas fa-dna me-2"></i>
                            ${protein} Expression
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="equation-latex mb-3">
                            $$${eq.latex}$$
                        </div>
                        <div class="equation-description">
                            <p class="text-muted mb-2">
                                <strong>Description:</strong> ${eq.description}
                            </p>
                            <div class="equation-components">
                                <strong>Components:</strong>
                                <ul class="mb-0">
                                    ${eq.components.map(comp => `<li class="small">${comp}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Render MathJax if available
        if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
            MathJax.typesetPromise([container]).catch((err) => console.log('MathJax error:', err));
        }
    }

    // Export project functionality
    function exportProject() {
        // Show loading state
        const exportBtn = document.getElementById('export-btn');
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exporting...';
        exportBtn.disabled = true;

        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = '/export';
        link.download = ''; // Let the server determine the filename
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset button after a short delay
        setTimeout(() => {
            exportBtn.innerHTML = originalText;
            exportBtn.disabled = false;
        }, 2000);
    }

    // Expose state for debugging
    window.circuitDesigner = {
        state: state,
        placeComponent: placeComponent,
        removeComponent: removeComponent,
        clearBoard: clearBoard,
        runSimulation: runSimulation,
        populateOntologyAnalysis: populateOntologyAnalysis,
        exportProject: exportProject
    };
});

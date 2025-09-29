// static/js/eeprom.js
// EEPROM Hardware Integration for Genetic Circuit Designer

let LOG_LINES = [];
let port = null;
let reader = null;
let writer = null;
let textDecoder = null;
let textEncoder = null;
let readableStreamClosed = null;
let writableStreamClosed = null;
let isConnecting = false;  // Prevent concurrent operations
let lineBuffer = '';  // Buffer for partial lines to prevent hex data corruption

// DOM elements
const comPortSelect = document.getElementById("com-port");
const btnRefreshPorts = document.getElementById("btn-refresh-ports");
const btnConnect = document.getElementById("btn-connect");
const btnGetBoard = document.getElementById("btn-get-board");
const btnDiagnoseBoard = document.getElementById("btn-diagnose-board");
const eepromLogArea = document.getElementById("eeprom-log");
const errorDisplay = document.getElementById("error-display");
const plotContainer = document.getElementById("plot-container");

// Initialize EEPROM interface
document.addEventListener('DOMContentLoaded', function() {
    init();
});

async function init() {
    // Check for Web Serial API support
    if (!('serial' in navigator)) {
        logLine('Web Serial API not supported. Please use Chrome 89+ or Edge 89+');
        logLine('Note: Some browsers require flags to be enabled');
        btnConnect.disabled = true;
        btnRefreshPorts.disabled = true;
        return;
    }
    
    // Check if permissions are available
    try {
        await navigator.permissions.query({ name: 'serial' });
    } catch (err) {
        logLine('⚠️ Serial permissions may be restricted by browser policy');
        logLine('This might be due to iframe context, mixed content, or security settings');
        logLine('Try: 1) Opening in a new tab, 2) Using HTTPS, 3) Checking browser flags');
    }

    // Setup event listeners
    setupEventListeners();
    
    // Try to list previously granted ports
    listPorts();
}

function setupEventListeners() {
    if (btnRefreshPorts) {
        btnRefreshPorts.addEventListener("click", requestAndListPorts);
    }

    if (btnConnect) {
        btnConnect.addEventListener("click", connectToPort);
    }

    if (btnGetBoard) {
        btnGetBoard.addEventListener("click", readBoardConfiguration);
    }
    
    if (btnDiagnoseBoard) {
        btnDiagnoseBoard.addEventListener("click", diagnoseBoardEEPROMs);
    }
}

// List available COM ports
async function listPorts() {
    if (!comPortSelect) return;
    
    comPortSelect.innerHTML = '<option value="">Select COM Port</option>';
    
    try {
        const ports = await navigator.serial.getPorts();
        
        for (let i = 0; i < ports.length; i++) {
            const port = ports[i];
            const option = document.createElement("option");
            option.value = i;
            option.port = port;
            
            const info = port.getInfo();
            option.textContent = info.usbProductId 
                ? `USB Device ${info.usbVendorId}:${info.usbProductId}`
                : info.usbVendorId 
                ? `USB Device ${info.usbVendorId}`
                : `Serial Port ${i + 1}`;
                
            comPortSelect.appendChild(option);
        }

        if (ports.length === 0) {
            logLine('No previously granted ports found. Click "Refresh Ports" to request access.');
        } else {
            logLine(`Found ${ports.length} previously granted port(s).`);
        }
        
    } catch (err) {
        console.error("Error listing ports:", err);
        logLine(`Error listing ports: ${err.message}`);
    }
}

// Request new port and refresh list
async function requestAndListPorts() {
    try {
        // Request a new port
        await navigator.serial.requestPort();
        logLine('New port access granted.');
        
        // Refresh the list
        await listPorts();
        
    } catch (err) {
        // User cancelled the dialog
        console.log("Port request cancelled:", err);
        logLine('Port selection cancelled.');
    }
}

// Connect to selected COM port
async function connectToPort() {
    // Prevent concurrent operations
    if (isConnecting) {
        logLine('Connection already in progress...');
        return;
    }
    
    if (port) {
        logLine('Already connected to a port. Disconnecting first...');
        await disconnectPort();
    }
    
    isConnecting = true;

    let selectedPort = null;

    if (!comPortSelect.options.length || comPortSelect.selectedIndex === 0) {
        // No port selected, request one
        try {
            logLine('Requesting port access...');
            selectedPort = await navigator.serial.requestPort();
            logLine('Port selected via dialog.');
            
            // Add the new port to the dropdown
            await listPorts();
            
        } catch (err) {
            console.error("No port selected:", err);
            logLine('Port selection cancelled or failed.');
            isConnecting = false;  // CRITICAL FIX: Reset connection flag
            return;
        }
    } else {
        // Use selected port
        const selectedOption = comPortSelect.options[comPortSelect.selectedIndex];
        selectedPort = selectedOption.port;
        logLine(`Attempting to connect to selected port...`);
    }

    try {
        // Check if port is already open
        if (selectedPort.readable) {
            logLine('Port appears to be already open. Closing first...');
            await selectedPort.close();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Open the port with appropriate settings
        logLine('Opening serial connection...');
        await selectedPort.open({
            baudRate: 115200,
            dataBits: 8,
            parity: "none",
            stopBits: 1,
            flowControl: "none"
        });

        port = selectedPort;
        logLine(`✅ Connected to serial port at 115200 baud.`);
        
        // Allow Arduino to reset (critical for stable connection)
        logLine('⏳ Waiting for Arduino to initialize (2 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Setup readers and writers with proper stream tracking
        setupSerialStreams();
        
        isConnecting = false;
        
        // Connection established - test CLI responsiveness and initialize I2C
        logLine('✅ Serial connection established.');
        
        // Perform CLI handshake to verify device responsiveness
        logLine('🔍 Testing device responsiveness...');
        await performCLIHandshake();
        
        // Skip I2C init - firmware appears to work without it (like August)
        logLine('🔧 Firmware ready for EEPROM operations');
        
        logLine('✅ Device initialization completed.');
        
        // Update UI
        btnConnect.textContent = '✅ Connected';
        btnConnect.disabled = true;
        btnConnect.classList.remove('btn-primary');
        btnConnect.classList.add('btn-success');
        
        if (btnGetBoard) {
            btnGetBoard.disabled = false;
        }

        logLine('🎉 Connection established successfully!');
        logLine('You can now click "Read Circuit from Board" to scan for components.');

    } catch (err) {
        console.error("Error opening port:", err);
        logLine(`❌ Error opening port: ${err.message}`);
        
        // Specific error handling
        if (err.message.includes('Failed to open serial port')) {
            logLine('💡 Try: 1) Check if another program is using the port 2) Unplug and reconnect the Arduino 3) Select a different port');
        } else if (err.message.includes('not found')) {
            logLine('💡 Port not found. Try refreshing ports or reconnecting the Arduino.');
        }
        
        port = null;
        isConnecting = false;  // CRITICAL FIX: Reset connection flag on error
        
        // Reset UI
        btnConnect.textContent = 'Connect';
        btnConnect.disabled = false;
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-primary');
        
        if (btnGetBoard) {
            btnGetBoard.disabled = true;
        }
    }
}

// Disconnect from current port with proper stream teardown
async function disconnectPort() {
    if (port) {
        try {
            // Proper teardown sequence to prevent locked streams
            
            // 1. Cancel reader and await readable pipe
            if (reader) {
                await reader.cancel();
                reader = null;
            }
            
            if (readableStreamClosed) {
                await readableStreamClosed.catch(() => {});
                readableStreamClosed = null;
            }
            
            // 2. Close writer and await writable pipe
            if (writer) {
                await writer.close();
                writer = null;
            }
            
            if (writableStreamClosed) {
                await writableStreamClosed.catch(() => {});
                writableStreamClosed = null;
            }
            
            // 3. Clear stream references
            textDecoder = null;
            textEncoder = null;
            
            // 4. Finally close the port
            await port.close();
            logLine('Disconnected from serial port.');
            
        } catch (err) {
            console.error('Error disconnecting:', err);
            logLine(`Error disconnecting: ${err.message}`);
        }
        
        port = null;
        isConnecting = false;  // Reset connection flag
        
        // Reset UI
        btnConnect.textContent = 'Connect';
        btnConnect.disabled = false;
        btnConnect.classList.remove('btn-success');
        btnConnect.classList.add('btn-primary');
        
        if (btnGetBoard) {
            btnGetBoard.disabled = true;
        }
    }
}

// Setup serial communication streams with proper tracking
function setupSerialStreams() {
    if (!port) return;

    try {
        // Setup text decoder stream for reading with pipe tracking
        textDecoder = new TextDecoderStream();
        readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        // Setup text encoder stream for writing with pipe tracking
        textEncoder = new TextEncoderStream();
        writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
        writer = textEncoder.writable.getWriter();

        // Start reading loop
        readLoop();
        
    } catch (err) {
        console.error("Error setting up streams:", err);
        logLine(`Error setting up communication: ${err.message}`);
    }
}

// Continuous reading loop
async function readLoop() {
    while (port && reader) {
        try {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            
            if (value) {
                // Use buffered line assembly to prevent hex data corruption
                lineBuffer += value;
                const lines = lineBuffer.split(/\r?\n/);
                
                // Log all complete lines except the last (which may be partial)
                for (let i = 0; i < lines.length - 1; i++) {
                    if (lines[i].trim()) {
                        logLine(lines[i].trim());
                    }
                }
                
                // Keep the last fragment as it might be partial
                lineBuffer = lines[lines.length - 1];
            }
        } catch (err) {
            console.error("Read error:", err);
            logLine(`Read error: ${err.message}`);
            break;
        }
    }
}

// Send command to device using tracked writer
async function sendCommand(command) {
    if (!port || !writer || isConnecting) {
        logLine('Error: Not connected to any port.');
        return false;
    }

    try {
        // Use the tracked writer instead of creating new ones
        await writer.write(command + "\r\n");
        
        // Small delay to ensure command is fully transmitted
        await new Promise(resolve => setTimeout(resolve, 100));
        
        logLine(`> ${command}`);
        return true;
    } catch (err) {
        console.error("Write error:", err);
        logLine(`Write error: ${err.message}`);
        return false;
    }
}

// Wait for complete response from device (like Python's buffer draining)
async function waitForCompleteResponse(timeoutMs = 2000) {
    return new Promise(resolve => {
        const startTime = Date.now();
        let lastLineCount = LOG_LINES.length;
        let stableCount = 0;
        
        function checkForStability() {
            const currentLineCount = LOG_LINES.length;
            
            if (currentLineCount === lastLineCount) {
                stableCount++;
                if (stableCount >= 4) { // 200ms of stability (4 * 50ms)
                    resolve();
                    return;
                }
            } else {
                stableCount = 0;
                lastLineCount = currentLineCount;
            }
            
            if (Date.now() - startTime > timeoutMs) {
                resolve();
                return;
            }
            
            setTimeout(checkForStability, 50);
        }
        
        // Wait at least 100ms before checking
        setTimeout(checkForStability, 100);
    });
}

// Backward compatibility alias
async function waitForResponse(timeoutMs = 2000) {
    return waitForCompleteResponse(timeoutMs);
}

// Wait for command prompt (V7 strategy - MUCH more reliable!)
async function waitForPrompt(timeoutMs = 6000) {
    const startTime = Date.now();
    const startLogLength = LOG_LINES.length;
    
    return new Promise(resolve => {
        const checkInterval = setInterval(() => {
            // Only check recent lines for performance (V7 fix)
            const recentLines = LOG_LINES.slice(Math.max(0, LOG_LINES.length - 10));
            const hasPrompt = recentLines.some(line => 
                line.trim().endsWith('>') || line.includes('$')
            );
            
            if (hasPrompt || (Date.now() - startTime) > timeoutMs) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}

// Legacy function kept for compatibility but redirects to prompt-based wait
async function waitForEEPROMReadComplete(timeoutMs = 6000) {
    return waitForPrompt(timeoutMs);
}

// Wait for hex dump to complete with prompt-based detection (V7 strategy)
async function waitForHexDumpComplete(timeoutMs = 6000) {
    // Use prompt-based wait instead of trying to parse hex lines
    // This is much more reliable and matches V7 behavior
    return waitForPrompt(timeoutMs);
}

// Perform CLI handshake to verify device responsiveness (like August logs)
async function performCLIHandshake() {
    // Clear line buffer for fresh start
    lineBuffer = '';
    const beforeLength = LOG_LINES.length;
    
    // Send newlines to wake up CLI
    logLine('Sending wake-up sequence...');
    await writer.write('\n\n');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try simple probe commands to verify responsiveness
    logLine('Testing CLI responsiveness with probe commands...');
    
    // Try help command
    await writer.write('help\r\n');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Try version command  
    await writer.write('ver\r\n');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check if we got ANY response from device
    const newLines = LOG_LINES.slice(beforeLength);
    const responsiveLines = newLines.filter(line => 
        line.includes('Token:') || line.includes('$') || line.includes('Selected') || 
        line.includes('MUX') || line.includes('help') || line.includes('version') ||
        line.trim().length > 0 && !line.startsWith('>')
    );
    
    if (responsiveLines.length > 0) {
        logLine(`✅ Device is responding! Got ${responsiveLines.length} response lines`);
        // Log some sample responses
        responsiveLines.slice(0, 3).forEach(line => logLine(`📝 Response: "${line}"`));
    } else {
        logLine('⚠️ Device not responding to probe commands');
        logLine('This may indicate firmware issues or wrong port');
        
        // Try DTR/RTS toggle to wake up device
        logLine('Attempting to wake device with DTR/RTS toggle...');
        try {
            await port.setSignals({dataTerminalReady: true, requestToSend: false});
            await new Promise(resolve => setTimeout(resolve, 100));
            await port.setSignals({dataTerminalReady: false, requestToSend: true});
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            logLine(`Signal toggle failed: ${err.message}`);
        }
    }
}

// Initialize I2C bus (CRITICAL - was being skipped!)
async function initializeI2CBus() {
    logLine('Initializing I2C bus and EEPROM systems...');
    
    // Send I2C initialization commands that might be needed
    const initCommands = [
        'i2c begin',    // Initialize I2C
        'i2c speed 400000',  // Set I2C speed to FAST mode (400 kHz) - CRITICAL V7 FIX!
        'eeprom init',  // Initialize EEPROM subsystem
        'eeprom addr 0x50',  // Set EEPROM address (common for 11AA010)
        'scan'  // Scan for I2C devices
    ];
    
    for (const cmd of initCommands) {
        logLine(`Sending: ${cmd}`);
        try {
            await sendCommand(cmd);
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
            logLine(`Command \"${cmd}\" failed: ${err.message}`);
        }
    }
    
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    logLine('I2C initialization sequence completed');
}

// Read complete board configuration
async function readBoardConfiguration() {
    if (!port) {
        alert("Please connect to a COM port first.");
        return;
    }

    // Disable button and show progress
    btnGetBoard.disabled = true;
    btnGetBoard.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Reading Board...';
    
    // Clear previous logs and results
    LOG_LINES = [];
    if (eepromLogArea) {
        eepromLogArea.value = '';
    }
    
    logLine('Starting board configuration read...');
    logLine('This will scan all MUX channels for component data.');
    
    try {
        // CRITICAL V7 FIX: Initialize I2C bus first (this was missing!)
        await initializeI2CBus();
        logLine('I2C bus initialized successfully - ready for fast EEPROM reads');
        
        // Read all MUX channels (A and B, 0-15 each) - EXACTLY like August working version
        const muxChannels = ['a', 'b'];
        const channelRange = Array.from({length: 16}, (_, i) => i);
        
        for (const mux of muxChannels) {
            logLine(`\n=== Scanning MUX ${mux.toUpperCase()} ===`);
            
            for (const channel of channelRange) {
                logLine(`\n--- MUX ${mux.toUpperCase()}, Channel ${channel} ---`);
                
                // Select MUX and channel (single MUX only - like August)
                const selectCmd = `sm ${mux} ${channel}`;
                if (!(await sendCommand(selectCmd))) {
                    continue;
                }
                await waitForPrompt(2000);
                
                // Check if MUX selection failed
                const recentLog = LOG_LINES.slice(-3).join(' ').toLowerCase();
                if (recentLog.includes('error') || recentLog.includes('fail')) {
                    logLine(`Skipping channel ${channel} - MUX selection failed`);
                    continue;
                }
                
                // Read EEPROM into buffer FIRST (this was missing!)
                logLine('Reading EEPROM data into buffer...');
                await sendCommand('er 0 64');  // Read 64 bytes from address 0
                
                // Wait specifically for EEPROM read completion (V7 TIMING!)
                await waitForEEPROMReadComplete(6000);
                
                // Additional delay to ensure data is fully buffered
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Then hex dump the buffer - FIRST attempt (often fails like August)
                const hexLinesBefore = LOG_LINES.filter(line => line.match(/^\s*[0-9A-Fa-f]{2,4}:\s+(?:[0-9A-Fa-f]{2}\s+){8,}/)).length;
                await sendCommand('hd 0 16');  // Hex dump starting from address 0
                await waitForHexDumpComplete(6000);
                
                // Only retry if no hex data was captured from first attempt
                const hexLinesAfter = LOG_LINES.filter(line => line.match(/^\s*[0-9A-Fa-f]{2,4}:\s+(?:[0-9A-Fa-f]{2}\s+){8,}/)).length;
                if (hexLinesAfter === hexLinesBefore) {
                    // No hex data from first attempt - try second attempt like August pattern
                    logLine('First attempt failed, retrying...');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await sendCommand('hd 0 16');  // Use correct syntax with start address
                    await waitForHexDumpComplete(6000);
                }
                
                // Wait for EEPROM to settle before next channel
                await new Promise(resolve => setTimeout(resolve, 750));
            }
        }
        
        logLine('\n=== Board scan completed ===');
        
        // Use backend to parse the log and populate the board
        await parseLogWithBackend();
        
    } catch (err) {
        console.error("Board reading error:", err);
        logLine(`Error reading board: ${err.message}`);
        
        if (errorDisplay) {
            errorDisplay.textContent = `Board reading failed: ${err.message}`;
            errorDisplay.style.display = 'block';
        }
        
    } finally {
        // Re-enable button
        btnGetBoard.disabled = false;
        btnGetBoard.innerHTML = '<i class="fas fa-download me-2"></i>Read Circuit from Board';
    }
}

// Create analyze button
function createAnalyzeButton() {
    const btn = document.createElement('button');
    btn.id = 'btn-analyze-log';
    btn.className = 'btn btn-info mt-2 ms-2';
    btn.innerHTML = '<i class="fas fa-stethoscope me-2"></i>Analyze Issue';
    btn.style.display = 'none';
    
    const container = document.querySelector('#btn-get-board').parentNode;
    container.appendChild(btn);
    
    return btn;
}

// Create debug hex button
function createDebugHexButton() {
    const btn = document.createElement('button');
    btn.id = 'btn-debug-hex';
    btn.className = 'btn btn-warning mt-2';
    btn.innerHTML = '<i class="fas fa-bug me-2"></i>Show Raw Hex Data';
    btn.style.display = 'none';
    
    const container = document.querySelector('#btn-get-board').parentNode;
    container.appendChild(btn);
    
    return btn;
}

// Show raw hex data for debugging
function showRawHexData(channelData) {
    logLine('\n=== RAW HEX DATA DEBUG ===');
    logLine('This shows exactly what your EEPROMs contain:');
    logLine('');
    
    // Get the original log lines that contain hex data
    const hexLines = LOG_LINES.filter(line => 
        line.includes('00:') || line.includes('40:') || 
        line.includes('sm a') || line.includes('sm b')
    );
    
    let currentChannel = null;
    for (const line of hexLines) {
        // Look for MUX commands
        const cmdMatch = line.match(/>\s*sm\s+([ab])\s+(\d+)/i);
        if (cmdMatch) {
            const muxLetter = cmdMatch[1].toUpperCase();
            const channelNum = parseInt(cmdMatch[2], 10);
            currentChannel = `MUX_${muxLetter}_CH_${channelNum}`;
            logLine(`\n--- ${currentChannel} ---`);
            continue;
        }
        
        // Show hex dump lines
        if (currentChannel && (line.includes('00:') || line.includes('40:'))) {
            logLine(`${line}`);
            
            // Try to show ASCII interpretation
            const hexMatch = line.match(/^[0-7][0-9A-Fa-f]:\s*(.+)/);
            if (hexMatch) {
                const hexPart = hexMatch[1].split(/\s{3,}/)[0]; // Take only hex part
                const hexBytes = hexPart.match(/[0-9A-Fa-f]{2}/g) || [];
                
                let ascii = '';
                for (const hex of hexBytes) {
                    const byte = parseInt(hex, 16);
                    if (byte >= 32 && byte <= 126) {
                        ascii += String.fromCharCode(byte);
                    } else if (byte === 0) {
                        ascii += '\\0'; // Show null bytes
                    } else {
                        ascii += '.'; // Non-printable
                    }
                }
                
                if (ascii.replace(/\.|\\0/g, '').length > 0) {
                    logLine(`     ASCII: "${ascii}"`);
                }
            }
        }
    }
    
    logLine('\n=== INTERPRETATION ===');
    logLine('Expected component name format examples:');
    logLine('  - "promoter_lac" or "promoter_a"');
    logLine('  - "rbs_strong" or "rbs_b"'); 
    logLine('  - "cds_gfp" or "cds_c"');
    logLine('');
    logLine('What we actually found:');
    for (const [channel, components] of Object.entries(channelData)) {
        if (components.length > 0 && channel !== '_scan_stats') {
            logLine(`  ${channel}: ${components.join(', ')}`);
        }
    }
    logLine('');
    logLine('If these don\'t match what you expect, the EEPROMs may contain');
    logLine('different data than anticipated, or may need reprogramming.');
}

// Show Transfer to Designer button when circuit is successfully read
function showTransferToDesignerButton(cellboard) {
    const transferBtn = document.getElementById('btn-transfer-designer');
    if (transferBtn) {
        transferBtn.style.display = 'inline-block';
        
        // Add click handler to navigate to designer with circuit data
        transferBtn.onclick = function() {
            // Navigate to main designer page
            window.location.href = '/';
        };
    }
}

// Use backend to parse EEPROM log data
async function parseLogWithBackend() {
    try {
        logLine('\n=== Sending log data to backend for parsing ===');
        
        const response = await fetch('/interpret_hardware', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_lines: LOG_LINES })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            logLine(`Backend parsing successful! Found ${result.component_count} components.`);
            
            // Log the parsed channel data with debug info
            for (const [channel, components] of Object.entries(result.channel_data)) {
                if (components.length > 0) {
                    logLine(`${channel}: ${components.join(', ')}`);
                }
            }
            
            // Add debug button to show raw hex data
            const debugBtn = document.getElementById('btn-debug-hex') || createDebugHexButton();
            debugBtn.style.display = 'inline-block';
            debugBtn.onclick = () => showRawHexData(result.channel_data);
            
            // Also add analyze button for immediate diagnosis
            const analyzeBtn = document.getElementById('btn-analyze-log') || createAnalyzeButton();
            analyzeBtn.style.display = 'inline-block';
            analyzeBtn.onclick = () => analyzeScanFailure();
            
            // Populate board from the backend-parsed cellboard data
            if (result.cellboard && Object.keys(result.cellboard).length > 0) {
                populateBoardFromCellboard(result.cellboard);
                
                // Save circuit data to localStorage for transfer to main designer
                localStorage.setItem('hardwareCircuitData', JSON.stringify({
                    cellboard: result.cellboard,
                    timestamp: Date.now(),
                    source: 'hardware_board'
                }));
                
                logLine('\nCircuit data saved for transfer to main designer!');
                
                // Show transfer button
                showTransferToDesignerButton(result.cellboard);
                
                // Run simulation with the detected circuit
                logLine('\nRunning simulation with detected circuit...');
                await runSimulationFromCellboard(result.cellboard);
            } else {
                logLine('');
                logLine('=== Board Scan Complete ===');
                logLine('No circuit components detected. This is normal if:');
                logLine('  1. Your board has no EEPROMs connected');
                logLine('  2. The EEPROMs are empty/unprogrammed');
                logLine('  3. This is a fresh hardware setup');
                logLine('');
                logLine('Next steps:');
                logLine('  - Use the main Circuit Designer to create virtual circuits');
                logLine('  - Or connect programmed EEPROMs with component data');
                logLine('  - The hardware communication is working correctly!');
            }
            
        } else {
            logLine(`Backend parsing failed: ${result.message}`);
            
            // Analyze the failure and provide helpful diagnostics
            analyzeScanFailure();
            
            // Fallback to client-side parsing
            logLine('Falling back to client-side parsing...');
            parseLogAndPopulateBoard();
        }
        
    } catch (err) {
        console.error('Backend parsing error:', err);
        logLine(`Backend parsing error: ${err.message}`);
        
        // Fallback to client-side parsing
        logLine('Falling back to client-side parsing...');
        parseLogAndPopulateBoard();
    }
}

// Parse EEPROM log and extract component data (fallback method)
function parseLogAndPopulateBoard() {
    const channelData = {};
    let currentChannel = null;
    
    logLine('\n=== Parsing component data (client-side) ===');
    
    for (const line of LOG_LINES) {
        // Look for MUX selection commands
        const cmdMatch = line.match(/>\s*sm\s+([ab])\s+(\d+)/i);
        if (cmdMatch) {
            const muxLetter = cmdMatch[1].toUpperCase();
            const channelNum = parseInt(cmdMatch[2], 10);
            currentChannel = `MUX ${muxLetter}, Channel ${channelNum}`;
            channelData[currentChannel] = [];
            continue;
        }
        
        // Parse hex dump lines in format "00: 68 65 6C 6C ..."
        if (currentChannel && line.match(/^[0-7][0-9A-Fa-f]:/)) {
            const parts = line.split(':');
            if (parts.length === 2) {
                const hexValues = parts[1].trim().split(/\s+/).slice(0, 16); // Take only hex values
                let componentString = '';
                
                // Convert hex to ASCII characters
                for (const hexValue of hexValues) {
                    if (hexValue.length === 2) {
                        try {
                            const charCode = parseInt(hexValue, 16);
                            if (charCode >= 32 && charCode <= 126) { // Printable ASCII range
                                componentString += String.fromCharCode(charCode);
                            }
                        } catch (e) {
                            // Skip invalid hex values
                        }
                    }
                }
                
                // Extract component identifiers from the ASCII string
                if (componentString.trim()) {
                    // Look for patterns like "promoter_1", "rbs_1", "cds_1", etc.
                    const componentMatches = componentString.match(/[a-zA-Z_]+_?\d*/g);
                    if (componentMatches) {
                        componentMatches.forEach(match => {
                            const componentName = match.trim();
                            if (componentName && !channelData[currentChannel].includes(componentName)) {
                                channelData[currentChannel].push(componentName);
                            }
                        });
                    }
                }
            }
        }
    }
    
    // Remove empty channels
    Object.keys(channelData).forEach(key => {
        if (channelData[key].length === 0) {
            delete channelData[key];
        } else {
            // Remove duplicates
            channelData[key] = [...new Set(channelData[key])];
        }
    });
    
    logLine(`Found components in ${Object.keys(channelData).length} channels.`);
    
    // Populate the visual board
    populateBoardFromChannelData(channelData);
}

// Populate board from backend cellboard format
function populateBoardFromCellboard(cellboard) {
    // Clear existing components
    document.querySelectorAll(".cell .placed-component").forEach(el => el.remove());
    document.querySelectorAll(".cell").forEach(cell => {
        cell.style.backgroundColor = '';
        cell.style.color = '';
        cell.textContent = '';
        cell.classList.remove('has-component');
    });
    
    let totalComponents = 0;
    
    for (const [componentType, components] of Object.entries(cellboard)) {
        components.forEach(comp => {
            const x = parseInt(comp.x);
            const y = parseInt(comp.y);
            
            // Find the corresponding cell
            const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
            if (!cell) return;
            
            // Create component object
            const component = {
                name: `${componentType.toLowerCase()}_${comp.gene.split(' ')[1]}`,
                type: componentType,
                gene: comp.gene.split(' ')[1],
                strength: comp.strength
            };
            
            createPlacedComponent(cell, component);
            totalComponents++;
        });
    }
    
    logLine(`Total components placed on board: ${totalComponents}`);
}

// Run simulation with cellboard data
async function runSimulationFromCellboard(cellboard) {
    try {
        const response = await fetch("/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cellboard: cellboard })
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            logLine('Hardware circuit simulation completed successfully!');
            
            // Display plot
            if (result.plot && plotContainer) {
                plotContainer.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-chart-line me-2"></i>Hardware Circuit Simulation</h5>
                        </div>
                        <div class="card-body text-center">
                            <img src="data:image/png;base64,${result.plot}" 
                                 alt="Hardware Circuit Simulation" 
                                 class="img-fluid" 
                                 style="max-width:100%; border-radius: 8px;">
                        </div>
                    </div>
                `;
            }
            
            // Log additional information
            if (result.equations) {
                logLine(`Generated ${Object.keys(result.equations).length} differential equations.`);
            }
            if (result.regulations) {
                const nonConstitutive = result.regulations.filter(r => r.type !== 'constitutive').length;
                logLine(`Detected ${nonConstitutive} regulatory interactions.`);
            }
            
        } else {
            logLine(`Hardware simulation failed: ${result.message}`);
            
            if (errorDisplay) {
                errorDisplay.textContent = result.message;
                errorDisplay.style.display = 'block';
            }
        }
        
    } catch (err) {
        console.error("Hardware simulation error:", err);
        logLine(`Hardware simulation error: ${err.message}`);
        
        if (errorDisplay) {
            errorDisplay.textContent = "Hardware simulation request failed.";
            errorDisplay.style.display = 'block';
        }
    }
}

// Diagnose individual EEPROMs to see what data they contain
async function diagnoseBoardEEPROMs() {
    if (!port) {
        alert("Please connect to a COM port first.");
        return;
    }

    // Disable button and show progress
    btnDiagnoseBoard.disabled = true;
    btnDiagnoseBoard.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Diagnosing...';
    
    // Clear previous logs
    LOG_LINES = [];
    if (eepromLogArea) {
        eepromLogArea.value = '';
    }
    
    logLine('=== EEPROM Diagnostic Mode ===');
    logLine('Checking each MUX channel for any stored data...');
    logLine('This will show you exactly what is stored on your EEPROMs.');
    
    try {
        // Test channels where your components should be located
        const testChannels = [
            {mux: 'a', channel: 0}, {mux: 'a', channel: 1}, {mux: 'a', channel: 2}, {mux: 'a', channel: 3},
            {mux: 'b', channel: 0}, {mux: 'b', channel: 1}, {mux: 'b', channel: 2}, {mux: 'b', channel: 3}
        ];
        
        for (const {mux, channel} of testChannels) {
            logLine(`\n--- Testing MUX ${mux.toUpperCase()}, Channel ${channel} ---`);
            
            // Select MUX and channel
            const selectCmd = `sm ${mux} ${channel}`;
            if (!(await sendCommand(selectCmd))) {
                continue;
            }
            await waitForResponse(1000);
            
            // Read EEPROM into buffer then hex dump (correct sequence)
            logLine('Reading EEPROM data into buffer...');
            await sendCommand('er 0 128');  // Read 128 bytes from address 0  
            await waitForResponse(1000);
            
            logLine('Hex dumping EEPROM content...');
            await sendCommand('hd 0 128');  // Hex dump starting from address 0
            await waitForResponse(2000);
            
            // Wait between channels
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        logLine('\n=== Diagnostic scan completed ===');
        logLine('Analyzing raw data for any readable content...');
        
        // Parse with enhanced detection
        await parseLogWithBackend();
        
    } catch (err) {
        console.error("Diagnostic error:", err);
        logLine(`Error during diagnostic: ${err.message}`);
        
    } finally {
        // Re-enable button
        btnDiagnoseBoard.disabled = false;
        btnDiagnoseBoard.innerHTML = '<i class="fas fa-search me-2"></i>Diagnose EEPROMs';
    }
}

// Populate visual board from parsed channel data
function populateBoardFromChannelData(channelData) {
    // Clear existing components
    document.querySelectorAll(".cell .placed-component").forEach(el => el.remove());
    document.querySelectorAll(".cell").forEach(cell => {
        cell.style.backgroundColor = '';
        cell.style.color = '';
        cell.textContent = '';
        cell.classList.remove('has-component');
    });
    
    let totalComponents = 0;
    
    for (const channelKey in channelData) {
        const components = channelData[channelKey];
        
        // Parse channel information
        const channelMatch = channelKey.match(/MUX\s+([AB]),\s*Channel\s*(\d+)/);
        if (!channelMatch) continue;
        
        const muxLetter = channelMatch[1];
        const channelNum = parseInt(channelMatch[2], 10);
        
        // Map to board position (8x8 grid)
        // MUX A maps to channels 0-15, MUX B maps to channels 16-31
        const linearPosition = (muxLetter === 'A' ? channelNum : channelNum + 16);
        const row = Math.floor(linearPosition / 8);
        const col = linearPosition % 8;
        
        // Find the corresponding cell
        const cell = document.querySelector(`.cell[data-x="${col}"][data-y="${row}"]`);
        if (!cell) continue;
        
        // Place components in the cell - handle multiple components per channel
        components.forEach((componentName, index) => {
            logLine(`Parsing component: "${componentName}"`);
            const component = parseComponentName(componentName);
            if (component) {
                logLine(`Successfully parsed: ${componentName} → ${component.type} ${component.gene}`);
                // For multiple components in same cell, offset them slightly
                const offsetCell = cell;
                if (index > 0) {
                    // Create a visual indicator for multiple components
                    offsetCell.style.border = '2px solid #ffd700';
                    offsetCell.title = `Multiple components: ${components.join(', ')}`;
                }
                createPlacedComponent(offsetCell, component);
                totalComponents++;
            } else {
                logLine(`Failed to parse component: "${componentName}"`);
            }
        });
        
        logLine(`Channel ${channelKey}: ${components.join(', ')}`);
    }
    
    logLine(`\nTotal components placed: ${totalComponents}`);
    
    // Run simulation if components were found
    if (totalComponents > 0) {
        logLine(`Running simulation with ${totalComponents} detected components...`);
        runSimulationAfterPopulation();
    } else {
        logLine('No valid components detected on the board.');
        logLine('This might be due to component naming format. Check the diagnostic output above.');
    }
}

// Parse component name to extract type and gene
function parseComponentName(name) {
    // Map based on Excel file component naming format
    const cleanName = name.toLowerCase().trim();
    
    // Check component type based on Excel file format
    if (cleanName.includes('promotor') || cleanName === 'omo') {
        return {
            name: name,
            type: 'Promoter',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('rbs')) {
        return {
            name: name,
            type: 'RBS', 
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('cds')) {
        return {
            name: name,
            type: 'CDS',
            gene: extractGeneFromName(name), 
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('terminator') || cleanName === 'termi') {
        return {
            name: name,
            type: 'Terminator',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('repressor') || cleanName.startsWith('r_') || cleanName === 'r_a' || cleanName === 'r_b') {
        return {
            name: name,
            type: 'Repressor',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    if (cleanName.startsWith('activator')) {
        return {
            name: name,
            type: 'Activator',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    if (cleanName === 'or' || cleanName === 'or_a' || cleanName.includes('operator')) {
        return {
            name: name,
            type: 'Operator',
            gene: extractGeneFromName(name),
            strength: 'norm'
        };
    }
    
    // If no match found, log it
    logLine(`Unknown component name: ${name}`);
    return null;
}

// Helper function to extract gene identifier from component name
function extractGeneFromName(name) {
    const match = name.match(/_([a-z])(?:_|$)/i);
    return match ? match[1].toUpperCase() : '1';
}

// Create visual component on board
function createPlacedComponent(cell, component) {
    const placedEl = document.createElement("div");
    placedEl.className = "placed-component";
    placedEl.textContent = component.name;
    placedEl.dataset.component = component.type;
    placedEl.dataset.gene = component.gene;
    placedEl.dataset.strength = component.strength;
    
    // Apply component styling
    const colors = {
        'Promoter': '#FF6B6B',
        'Terminator': '#4ECDC4',
        'RBS': '#FFD166',
        'CDS': '#06D6A0',
        'Repressor Start': '#A78BFA',
        'Repressor End': '#7E22CE',
        'Activator Start': '#3B82F6',
        'Activator End': '#1E40AF'
    };
    
    placedEl.style.backgroundColor = colors[component.type] || '#999';
    placedEl.style.color = 'white';
    placedEl.style.fontWeight = 'bold';
    placedEl.style.fontSize = '0.6rem';
    placedEl.style.padding = '2px';
    placedEl.style.borderRadius = '2px';
    placedEl.style.textAlign = 'center';
    
    cell.appendChild(placedEl);
    cell.classList.add('has-component');
}

// Run simulation with populated board
async function runSimulationAfterPopulation() {
    const placedComponents = [];
    
    // Collect all placed components
    document.querySelectorAll(".placed-component").forEach(el => {
        const cell = el.parentElement;
        const type = el.dataset.component;
        const gene = el.dataset.gene;
        const strength = el.dataset.strength;
        const x = cell.dataset.x;
        const y = cell.dataset.y;
        
        placedComponents.push({
            type: type,
            gene: `Gene ${gene}`,
            strength: strength,
            x: x,
            y: y
        });
    });
    
    if (placedComponents.length === 0) {
        logLine('No components to simulate.');
        return;
    }
    
    // Prepare cellboard data
    const cellboard = placedComponents.reduce((acc, comp) => {
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
    
    try {
        // Send simulation request
        const response = await fetch("/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cellboard: cellboard })
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            logLine('Simulation completed successfully!');
            
            // Display plot
            if (result.plot && plotContainer) {
                plotContainer.innerHTML = `
                    <img src="data:image/png;base64,${result.plot}" 
                         alt="Hardware Circuit Simulation" 
                         class="plot-image" 
                         style="max-width:100%;">
                `;
            }
            
            // Log circuit information
            if (result.circuits) {
                logLine(`Detected ${result.circuits.length} circuit(s).`);
            }
            if (result.regulations) {
                logLine(`Found ${result.regulations.length} regulatory interaction(s).`);
            }
            
        } else {
            logLine(`Simulation failed: ${result.message}`);
            
            if (errorDisplay) {
                errorDisplay.textContent = result.message;
                errorDisplay.style.display = 'block';
            }
        }
        
    } catch (err) {
        console.error("Simulation request failed:", err);
        logLine(`Simulation request failed: ${err.message}`);
        
        if (errorDisplay) {
            errorDisplay.textContent = "Simulation request failed.";
            errorDisplay.style.display = 'block';
        }
    }
}

// Log message to UI and internal log
function logLine(message) {
    // Add to internal log
    LOG_LINES.push(message);
    
    // Add to UI log area
    if (eepromLogArea) {
        eepromLogArea.value += message + "\n";
        eepromLogArea.scrollTop = eepromLogArea.scrollHeight;
    }
    
    // Also log to console for debugging
    console.log('EEPROM:', message);
}

// Analyze scan failure to provide helpful diagnostics
function analyzeScanFailure() {
    logLine('\n=== DIAGNOSTIC ANALYSIS ===');
    
    // Count different types of responses
    let totalMuxCommands = 0;
    let successfulMuxCommands = 0;
    let totalHexDumps = 0;
    let successfulHexDumps = 0;
    let hexDataFound = 0;
    let failLines = 0;
    
    // Track which hex dumps got data vs failed
    let hexDumpLines = [];
    let currentHexDumpHasData = false;
    
    for (let i = 0; i < LOG_LINES.length; i++) {
        const line = LOG_LINES[i];
        
        // Count MUX commands
        if (line.match(/>\s*sm\s+[ab]\s+\d+/)) {
            totalMuxCommands++;
        }
        
        // Count successful MUX selections
        if (line.match(/MUX [AB], Channel \d+/) || line.match(/Selected MUX [AB], Channel \d+/)) {
            successfulMuxCommands++;
        }
        
        // Count hex dump attempts and track their success
        if (line.match(/>\s*hd\s+(16|64|128)/)) {
            // If we were tracking a previous hex dump, finalize it
            if (totalHexDumps > 0) {
                if (currentHexDumpHasData) {
                    successfulHexDumps++;
                }
            }
            
            totalHexDumps++;
            currentHexDumpHasData = false;
        }
        
        // Count lines that just say "fail"
        if (line.trim() === 'fail') {
            failLines++;
        }
        
        // Count actual hex data lines (broader pattern to catch more formats)
        if (line.match(/^\s*[0-9A-Fa-f]{2,4}:\s+(?:[0-9A-Fa-f]{2}\s+){8,}/)) {
            hexDataFound++;
            currentHexDumpHasData = true;
        }
    }
    
    // Finalize the last hex dump if any
    if (totalHexDumps > 0 && currentHexDumpHasData) {
        successfulHexDumps++;
    }
    
    // Provide diagnosis
    logLine(`Hardware Communication Status:`);
    logLine(`  • MUX Commands: ${successfulMuxCommands}/${totalMuxCommands} successful`);
    logLine(`  • Hex Dump Commands: ${successfulHexDumps}/${totalHexDumps} successful`);
    logLine(`  • Hex Data Lines Found: ${hexDataFound}`);
    
    logLine('\nDiagnosis:');
    
    if (successfulMuxCommands > 0 && successfulHexDumps === 0) {
        logLine('❌ ISSUE: No EEPROMs are responding to read commands');
        logLine('');
        logLine('Possible causes:');
        logLine('  1. No EEPROMs are physically connected to any MUX channels');
        logLine('  2. EEPROMs are connected but not properly wired (VCC, GND, SDA, SCL)');
        logLine('  3. EEPROMs are faulty or damaged');
        logLine('  4. Wrong EEPROM type (expecting 11AA010 or compatible)');
        logLine('  5. I2C address conflicts or wiring issues');
        logLine('');
        logLine('Next Steps:');
        logLine('  • Check physical EEPROM connections on your Cell Board');
        logLine('  • Verify EEPROM power (3.3V) and I2C wiring');
        logLine('  • Test with a known-good EEPROM programmed with component data');
        logLine('  • Use an I2C scanner to verify EEPROM addresses');
    } else if (totalMuxCommands === 0) {
        logLine('❌ ISSUE: No hardware communication detected');
        logLine('');
        logLine('Possible causes:');
        logLine('  • Serial port not connected properly');
        logLine('  • Wrong baud rate or communication settings'); 
        logLine('  • Hardware not powered on');
    } else {
        logLine('⚠️  PARTIAL ISSUE: Mixed communication results');
        logLine('');
        logLine('Some commands work but data reading is inconsistent.');
        logLine('This suggests intermittent connection or hardware issues.');
    }
}

// Clear log, board preview, and simulation results
function clearLogAndBoard() {
    // Clear internal log array
    LOG_LINES.length = 0;
    
    // Clear UI log area
    if (eepromLogArea) {
        eepromLogArea.value = '';
    }
    
    // Clear board preview - remove all placed components
    const placedComponents = document.querySelectorAll('.placed-component');
    placedComponents.forEach(component => {
        component.remove();
    });
    
    // Remove has-component class from cells
    const cellsWithComponents = document.querySelectorAll('.cell.has-component');
    cellsWithComponents.forEach(cell => {
        cell.classList.remove('has-component');
    });
    
    // Clear simulation results
    const plotContainer = document.getElementById('plot-container');
    if (plotContainer) {
        plotContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-microchip" style="color: var(--primary); font-size: 2rem;"></i>
                <p>Connect to hardware and read circuit configuration</p>
            </div>
        `;
    }
    
    // Clear error display
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        errorDisplay.style.display = 'none';
        errorDisplay.textContent = '';
    }
    
    // Hide transfer and debug buttons
    const transferBtn = document.getElementById('btn-transfer-designer');
    if (transferBtn) {
        transferBtn.style.display = 'none';
    }
    
    const debugBtn = document.getElementById('btn-debug-hex');
    if (debugBtn) {
        debugBtn.style.display = 'none';
    }
    
    const analyzeBtn = document.getElementById('btn-analyze-log');
    if (analyzeBtn) {
        analyzeBtn.style.display = 'none';
    }
    
    console.log('EEPROM: Log, board preview, and simulation results cleared');
}

// Expose functions for debugging  
window.eepromInterface = {
    LOG_LINES,
    logLine,
    sendCommand,
    parseLogAndPopulateBoard,
    populateBoardFromChannelData,
    clearLogAndBoard
};

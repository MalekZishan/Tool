document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // Tab Panel Switch Logic
    // -------------------------------------------------------------
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // Toggle active tabs
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle active panels
            tabPanels.forEach(panel => {
                if (panel.id === targetTab) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });

    // -------------------------------------------------------------
    // Single Email Verification Logic
    // -------------------------------------------------------------
    const singleForm = document.getElementById('verifier-form');
    const emailInput = document.getElementById('email-input');
    const verifyBtn = document.getElementById('verify-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const resultContainer = document.getElementById('result-container');

    const ICONS = {
        error: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
        success: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
        warning: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>`
    };

    function appendSvg(parent, type) {
        const svgString = ICONS[type];
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = doc.documentElement;
        parent.appendChild(svgElement);
    }

    if (singleForm) {
        singleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) return;

            verifyBtn.disabled = true;
            btnText.textContent = "Verifying...";
            btnSpinner.classList.remove('hidden');
            
            resultContainer.classList.add('hidden');
            resultContainer.replaceChildren();

            try {
                const response = await fetch(`/api/verify?email=${encodeURIComponent(email)}`);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                const data = await response.json();
                renderSingleResult(data);
            } catch (error) {
                console.error(error);
                renderSingleErrorFallback(email, error.message || 'Service unavailable.');
            } finally {
                verifyBtn.disabled = false;
                btnText.textContent = "Verify Status";
                btnSpinner.classList.add('hidden');
            }
        });
    }

    function renderSingleResult(data) {
        const email = data.email;
        const status = data.status;
        const reason = data.reason;
        
        const card = document.createElement('div');
        card.className = `result-card status-${status}`;
        card.id = 'verification-result-card';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'status-icon';
        appendSvg(iconDiv, status === 'invalid' ? 'error' : (status === 'valid' ? 'success' : 'warning'));
        card.appendChild(iconDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'result-content';

        const titleText = document.createElement('span');
        titleText.className = 'result-message-title';
        titleText.textContent = `${email} | ${status === 'valid' ? 'Email exists and is active' : reason}`;
        contentDiv.appendChild(titleText);

        const badgesContainer = document.createElement('div');
        badgesContainer.className = 'result-badge-list';

        const isFormatInvalid = (reason === 'Invalid email format');
        const sBadge = document.createElement('span');
        sBadge.className = isFormatInvalid ? 'badge' : 'badge badge-active';
        sBadge.textContent = isFormatInvalid ? 'Format: Invalid' : 'Format: OK';
        badgesContainer.appendChild(sBadge);

        const mxBadge = document.createElement('span');
        mxBadge.className = data.has_mx ? 'badge badge-active' : 'badge';
        mxBadge.textContent = data.has_mx ? 'MX Server: Found' : 'MX Server: Missing';
        badgesContainer.appendChild(mxBadge);

        const dispBadge = document.createElement('span');
        dispBadge.className = data.is_disposable ? 'badge badge-active' : 'badge';
        dispBadge.textContent = data.is_disposable ? 'Disposable: Yes' : 'Disposable: No';
        badgesContainer.appendChild(dispBadge);

        const existBadge = document.createElement('span');
        existBadge.className = 'badge badge-active';
        existBadge.textContent = status === 'valid' ? 'Mailbox: Active' : (status === 'invalid' ? 'Mailbox: Non-existing' : 'Mailbox: Unverifiable');
        badgesContainer.appendChild(existBadge);

        contentDiv.appendChild(badgesContainer);
        card.appendChild(contentDiv);
        resultContainer.appendChild(card);
        resultContainer.classList.remove('hidden');
    }

    function renderSingleErrorFallback(email, errMessage) {
        const card = document.createElement('div');
        card.className = 'result-card status-invalid';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'status-icon';
        appendSvg(iconDiv, 'error');
        card.appendChild(iconDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'result-content';

        const titleText = document.createElement('span');
        titleText.className = 'result-message-title';
        titleText.textContent = `${email} | Error: ${errMessage}`;
        contentDiv.appendChild(titleText);

        card.appendChild(contentDiv);
        resultContainer.appendChild(card);
        resultContainer.classList.remove('hidden');
    }

    // -------------------------------------------------------------
    // Bulk Email Verification Logic
    // -------------------------------------------------------------
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const mappingPanel = document.getElementById('mapping-panel');
    const progressPanel = document.getElementById('progress-panel');
    
    const fileNameText = document.getElementById('file-name');
    const fileSizeText = document.getElementById('file-size');
    const resetFileBtn = document.getElementById('reset-file-btn');
    
    const sheetSelectGroup = document.getElementById('sheet-selector-group');
    const sheetSelect = document.getElementById('sheet-select');
    const columnSelect = document.getElementById('column-select');
    const previewTable = document.getElementById('preview-table');
    const startBtn = document.getElementById('start-btn');

    const countValid = document.getElementById('count-valid');
    const countInvalid = document.getElementById('count-invalid');
    const countUnknown = document.getElementById('count-unknown');
    const countTotal = document.getElementById('count-total');
    
    const progressText = document.getElementById('progress-text');
    const progressRate = document.getElementById('progress-rate');
    const progressBarFill = document.getElementById('progress-bar-fill');
    
    const pauseBtn = document.getElementById('pause-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const downloadBtn = document.getElementById('download-btn');
    const clearBulkBtn = document.getElementById('clear-bulk-btn');
    
    const resultsTbody = document.getElementById('results-tbody');

    // State Variables
    let currentWorkbook = null;
    let originalRows = [];
    let emailColumn = '';
    let emailList = [];
    
    let currentIndex = 0;
    let concurrencyLimit = 2;
    let activeWorkers = 0;
    
    let isPaused = false;
    let isCancelled = false;
    let startTime = null;
    let lastSecondTime = null;
    
    let stats = { valid: 0, invalid: 0, unknown: 0, total: 0 };
    let resultsData = []; // Array of processed results for excel export

    // Setup Drag-and-drop events
    if (dropzone) {
        dropzone.addEventListener('click', () => fileInput.click());
        
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('active');
        });
        
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('active');
        });
        
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('active');
            if (e.dataTransfer.files.length > 0) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileSelection(fileInput.files[0]);
            }
        });
    }

    resetFileBtn.addEventListener('click', () => {
        resetToInitialState();
    });

    function handleFileSelection(file) {
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExt = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(fileExt)) {
            alert('Unsupported file format! Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
            return;
        }

        fileNameText.textContent = file.name;
        fileSizeText.textContent = formatBytes(file.size);

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                currentWorkbook = XLSX.read(data, { type: 'array' });
                
                // Populate Worksheet Selector
                sheetSelect.replaceChildren();
                currentWorkbook.SheetNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    sheetSelect.appendChild(option);
                });

                if (currentWorkbook.SheetNames.length > 1) {
                    sheetSelectGroup.classList.remove('hidden');
                } else {
                    sheetSelectGroup.classList.add('hidden');
                }

                loadSheetData(currentWorkbook.SheetNames[0]);
                
                dropzone.classList.add('hidden');
                mappingPanel.classList.remove('hidden');
            } catch (err) {
                console.error(err);
                alert(`Error parsing file: ${err.message}`);
                resetToInitialState();
            }
        };
        reader.readAsArrayBuffer(file);
    }

    sheetSelect.addEventListener('change', () => {
        if (currentWorkbook) {
            loadSheetData(sheetSelect.value);
        }
    });

    columnSelect.addEventListener('change', () => {
        emailColumn = columnSelect.value;
        renderPreviewTable();
    });

    function loadSheetData(sheetName) {
        const worksheet = currentWorkbook.Sheets[sheetName];
        
        // Fetch rows and headers
        const headerData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = headerData[0] || [];
        
        originalRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        // Populate Columns Selector
        columnSelect.replaceChildren();
        headers.forEach(h => {
            const option = document.createElement('option');
            option.value = h;
            option.textContent = h;
            columnSelect.appendChild(option);
        });

        // Auto detect email column
        emailColumn = autoSelectEmailColumn(headers);
        columnSelect.value = emailColumn;

        renderPreviewTable();
    }

    function renderPreviewTable() {
        previewTable.replaceChildren();
        if (originalRows.length === 0) return;

        const headers = Object.keys(originalRows[0]);
        
        // Table Head
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            if (h === emailColumn) {
                th.style.color = 'var(--primary-color)';
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        previewTable.appendChild(thead);

        // Table Body (5 rows)
        const tbody = document.createElement('tbody');
        const previewRows = originalRows.slice(0, 5);
        previewRows.forEach(row => {
            const tr = document.createElement('tr');
            headers.forEach(h => {
                const td = document.createElement('td');
                td.textContent = row[h];
                if (h === emailColumn) {
                    td.style.fontWeight = 'bold';
                    td.style.color = 'var(--text-main)';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        previewTable.appendChild(tbody);
    }

    function autoSelectEmailColumn(headers) {
        const keywords = ['email', 'e-mail', 'mail', 'address', 'contact'];
        for (let i = 0; i < headers.length; i++) {
            const h = String(headers[i]).toLowerCase().trim();
            if (h === 'email' || h === 'e-mail' || h === 'email_address' || h === 'emailaddress') {
                return headers[i];
            }
        }
        for (let i = 0; i < headers.length; i++) {
            const h = String(headers[i]).toLowerCase().trim();
            if (keywords.some(k => h.includes(k))) {
                return headers[i];
            }
        }
        return headers[0] || '';
    }

    // -------------------------------------------------------------
    // Verification Processing Logic
    // -------------------------------------------------------------
    startBtn.addEventListener('click', () => {
        emailList = originalRows.map(row => String(row[emailColumn] || '').trim());
        
        stats = { valid: 0, invalid: 0, unknown: 0, total: emailList.length };
        currentIndex = 0;
        isPaused = false;
        isCancelled = false;
        resultsData = [];
        startTime = Date.now();
        
        // Reset Counter displays
        countValid.textContent = '0';
        countInvalid.textContent = '0';
        countUnknown.textContent = '0';
        countTotal.textContent = String(stats.total);
        
        progressText.textContent = `Processing: 0 / ${stats.total} (0%)`;
        progressRate.textContent = 'Calculating...';
        progressBarFill.style.width = '0%';

        // Reset live tables
        resultsTbody.replaceChildren();
        emailList.forEach((email, index) => {
            const tr = document.createElement('tr');
            tr.id = `results-row-${index}`;
            
            const tdIndex = document.createElement('td');
            tdIndex.textContent = String(index + 1);
            tr.appendChild(tdIndex);

            const tdEmail = document.createElement('td');
            tdEmail.textContent = email || '[Empty]';
            tdEmail.className = 'email-cell';
            tr.appendChild(tdEmail);

            const tdStatus = document.createElement('td');
            tdStatus.innerHTML = `<span class="status-badge-text pending">Pending</span>`;
            tr.appendChild(tdStatus);

            const tdDetails = document.createElement('td');
            tdDetails.textContent = '-';
            tr.appendChild(tdDetails);

            const tdMailbox = document.createElement('td');
            tdMailbox.textContent = '-';
            tr.appendChild(tdMailbox);

            resultsTbody.appendChild(tr);
        });

        mappingPanel.classList.add('hidden');
        progressPanel.classList.remove('hidden');

        pauseBtn.textContent = 'Pause';
        pauseBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        downloadBtn.classList.add('hidden');
        clearBulkBtn.classList.add('hidden');

        // Spawn queue workers
        activeWorkers = 0;
        for (let i = 0; i < concurrencyLimit; i++) {
            activeWorkers++;
            runWorker();
        }
    });

    async function runWorker() {
        if (isPaused || isCancelled) {
            activeWorkers--;
            return;
        }

        if (currentIndex >= emailList.length) {
            activeWorkers--;
            if (activeWorkers === 0) {
                finishProcessing();
            }
            return;
        }

        const index = currentIndex++;
        const rowData = originalRows[index];
        const email = emailList[index];

        // Update row visually to processing status
        const row = document.getElementById(`results-row-${index}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            const statusCell = row.children[2];
            statusCell.innerHTML = `<span class="status-badge-text processing">Verifying...</span>`;
        }

        try {
            if (!email) {
                handleResult(index, rowData, '', {
                    status: 'invalid',
                    reason: 'Empty email cell',
                    has_mx: false,
                    is_disposable: false,
                    exists: false
                });
            } else {
                const response = await fetch(`/api/verify?email=${encodeURIComponent(email)}`);
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                const result = await response.json();
                handleResult(index, rowData, email, result);
            }
        } catch (err) {
            console.error(err);
            handleResult(index, rowData, email, {
                status: 'unknown',
                reason: `Request failed: ${err.message}`,
                has_mx: false,
                is_disposable: false,
                exists: false
            });
        }

        // Continue immediately
        runWorker();
    }

    function handleResult(index, originalRow, email, result) {
        if (isCancelled) return;

        // Save stat counters
        if (result.status === 'valid') stats.valid++;
        else if (result.status === 'invalid') stats.invalid++;
        else stats.unknown++;

        // Update live table cells
        const row = document.getElementById(`results-row-${index}`);
        if (row) {
            const statusCell = row.children[2];
            const detailsCell = row.children[3];
            const mailboxCell = row.children[4];

            statusCell.innerHTML = `<span class="status-badge-text ${result.status}">${result.status}</span>`;
            
            const badges = [];
            badges.push(result.has_mx ? 'MX: OK' : 'MX: Fail');
            if (result.is_disposable) badges.push('DISPOSABLE');
            detailsCell.textContent = badges.join(', ');

            mailboxCell.textContent = result.reason;
        }

        // Save row details to download dataset
        const verifiedRow = { ...originalRow };
        verifiedRow['Verification Status'] = result.status.toUpperCase();
        verifiedRow['Reason'] = result.reason;
        verifiedRow['MX Server Status'] = result.has_mx ? 'FOUND' : 'MISSING';
        verifiedRow['Disposable Check'] = result.is_disposable ? 'YES' : 'NO';
        verifiedRow['Mailbox Deliverable'] = result.status === 'valid' ? 'ACTIVE' : (result.status === 'invalid' ? 'NON-EXISTING' : 'UNVERIFIABLE');
        
        resultsData[index] = verifiedRow;

        updateProgressUI();
    }

    function updateProgressUI() {
        const processed = stats.valid + stats.invalid + stats.unknown;
        const pct = stats.total > 0 ? Math.round((processed / stats.total) * 100) : 0;
        
        countValid.textContent = String(stats.valid);
        countInvalid.textContent = String(stats.invalid);
        countUnknown.textContent = String(stats.unknown);
        
        progressText.textContent = `Processing: ${processed} / ${stats.total} (${pct}%)`;
        progressBarFill.style.width = `${pct}%`;

        // Calculate processing rate
        const timeElapsed = (Date.now() - startTime) / 1000;
        const rateVal = processed > 0 ? (timeElapsed / processed).toFixed(1) : 0;
        progressRate.textContent = `Rate: ${rateVal}s / email`;
    }

    function finishProcessing() {
        pauseBtn.classList.add('hidden');
        cancelBtn.classList.add('hidden');
        downloadBtn.classList.remove('hidden');
        clearBulkBtn.classList.remove('hidden');
        progressRate.textContent = `Completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    }

    pauseBtn.addEventListener('click', () => {
        if (isPaused) {
            // Resume
            isPaused = false;
            pauseBtn.textContent = 'Pause';
            startTime = Date.now() - ((stats.valid + stats.invalid + stats.unknown) * parseFloat(progressRate.textContent.replace('Rate: ', '').replace('s / email', '')) * 1000); // adjust startTime to preserve correct average rate
            
            // Re-spawn workers
            activeWorkers = 0;
            for (let i = 0; i < concurrencyLimit; i++) {
                activeWorkers++;
                runWorker();
            }
        } else {
            // Pause
            isPaused = true;
            pauseBtn.textContent = 'Resume';
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel the verification? all remaining rows will be skipped.')) {
            isCancelled = true;
            finishProcessing();
            progressText.textContent = `Cancelled: Completed ${stats.valid + stats.invalid + stats.unknown} / ${stats.total}`;
            
            // Mark remaining rows as cancelled
            for (let i = currentIndex; i < stats.total; i++) {
                const row = document.getElementById(`results-row-${i}`);
                if (row) {
                    row.children[2].innerHTML = `<span class="status-badge-text pending">Skipped</span>`;
                }
            }
        }
    });

    downloadBtn.addEventListener('click', () => {
        try {
            // Re-compile all entries. If processing was cancelled, make sure skipped rows have original content
            const exportDataset = [];
            for (let i = 0; i < stats.total; i++) {
                if (resultsData[i]) {
                    exportDataset.push(resultsData[i]);
                } else {
                    const rowData = { ...originalRows[i] };
                    rowData['Verification Status'] = 'SKIPPED';
                    rowData['Reason'] = 'Cancelled by user';
                    rowData['MX Server Status'] = '-';
                    rowData['Disposable Check'] = '-';
                    rowData['Mailbox Deliverable'] = '-';
                    exportDataset.push(rowData);
                }
            }

            const worksheet = XLSX.utils.json_to_sheet(exportDataset);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Verified List");
            
            // Save file
            XLSX.writeFile(workbook, "sleekmail_verified_report.xlsx");
        } catch (err) {
            alert(`Failed to export report: ${err.message}`);
        }
    });

    clearBulkBtn.addEventListener('click', () => {
        resetToInitialState();
    });

    function resetToInitialState() {
        fileInput.value = '';
        currentWorkbook = null;
        originalRows = [];
        emailColumn = '';
        emailList = [];
        resultsData = [];
        
        isPaused = false;
        isCancelled = false;
        
        mappingPanel.classList.add('hidden');
        progressPanel.classList.add('hidden');
        dropzone.classList.remove('hidden');
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});

// OUHSC Research Compliance Navigator - Main Application
// Author: Geneva Daniel
// Version: 2.0

class ResearchNavigator {
    constructor() {
        this.decisionTree = null;
        this.currentQuestionId = null;
        this.answers = {};
        this.checklist = [];
        this.questionHistory = [];
        this.pendingRoutes = [];

        this.init();
    }

    async init() {
        // Set up event listeners first so buttons work even if data fails to load
        this.setupEventListeners();
        console.log('Event listeners set up');

        try {
            console.log('Starting initialization...');

            // Load decision tree data
            await this.loadDecisionTree();
            console.log('Decision tree loaded successfully');

            // Check for saved progress
            this.checkSavedProgress();

            // Display version info
            this.displayVersionInfo();

            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Failed to load application: ' + error.message + '\n\nIf you are opening this file directly in your browser, you need to use a local web server instead.\n\nOption 1: Use VS Code Live Server extension\nOption 2: Run "python -m http.server" in the folder\nOption 3: Deploy to SharePoint or a web server');
        }
    }

    async loadDecisionTree() {
        try {
            const response = await fetch('decisionTree.json');
            if (!response.ok) throw new Error('Failed to load decision tree');
            this.decisionTree = await response.json();
        } catch (error) {
            console.error('Error loading decision tree via fetch:', error);
            // Fallback: check if data was embedded via script tag
            if (typeof DECISION_TREE_DATA !== 'undefined') {
                console.log('Using embedded decision tree data');
                this.decisionTree = DECISION_TREE_DATA;
            } else {
                throw new Error('Could not load decision tree. If opening locally, please use a web server.');
            }
        }
    }

    setupEventListeners() {
        // Welcome screen buttons
        document.getElementById('startNewBtn').addEventListener('click', () => this.startNewAssessment());
        document.getElementById('loadProgressBtn').addEventListener('click', () => this.loadProgress());

        // Navigation buttons
        document.getElementById('prevBtn').addEventListener('click', () => this.previousQuestion());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('finishBtn').addEventListener('click', () => this.showSummary());

        // Header buttons
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        document.getElementById('saveProgressBtn').addEventListener('click', () => this.saveProgress());

        // Summary screen buttons
        document.getElementById('printBtn').addEventListener('click', () => this.printChecklist());
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.exportPDF());
        document.getElementById('emailBtn').addEventListener('click', () => this.emailChecklist());
        document.getElementById('restartBtn2').addEventListener('click', () => this.restart());
    }

    displayVersionInfo() {
        const lastUpdated = this.decisionTree.metadata.lastUpdated;
        const versionElement = document.getElementById('lastUpdated');
        if (versionElement) {
            versionElement.textContent = lastUpdated;
        }
    }

    checkSavedProgress() {
        const saved = localStorage.getItem('ouhsc_research_navigator_progress');
        if (saved) {
            document.getElementById('loadProgressBtn').style.display = 'inline-flex';
        }
    }

    startNewAssessment() {
        console.log('Starting new assessment...');

        this.answers = {};
        this.checklist = [];
        this.questionHistory = [];
        this.pendingRoutes = [];

        // Check if decision tree loaded
        if (!this.decisionTree || !this.decisionTree.questions || this.decisionTree.questions.length === 0) {
            alert('Error: Decision tree not loaded. Make sure decisionTree.json is in the same folder as index.html');
            console.error('Decision tree state:', this.decisionTree);
            return;
        }

        // Start with first question
        const firstQuestion = this.decisionTree.questions[0];
        this.currentQuestionId = firstQuestion.id;

        console.log('First question:', firstQuestion);

        this.showQuestionScreen();
        this.displayQuestion(firstQuestion);
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem('ouhsc_research_navigator_progress');
            if (saved) {
                const data = JSON.parse(saved);
                this.answers = data.answers;
                this.checklist = data.checklist;
                this.questionHistory = data.questionHistory;
                this.currentQuestionId = data.currentQuestionId;
                this.pendingRoutes = data.pendingRoutes || [];

                const question = this.findQuestionById(this.currentQuestionId);
                this.showQuestionScreen();
                this.displayQuestion(question);
                this.updateLiveChecklist();
            }
        } catch (error) {
            console.error('Error loading progress:', error);
            alert('Failed to load saved progress. Starting new assessment.');
            this.startNewAssessment();
        }
    }

    saveProgress() {
        try {
            const data = {
                answers: this.answers,
                checklist: this.checklist,
                questionHistory: this.questionHistory,
                currentQuestionId: this.currentQuestionId,
                pendingRoutes: this.pendingRoutes,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('ouhsc_research_navigator_progress', JSON.stringify(data));
            this.showNotification('Progress saved successfully!');
        } catch (error) {
            console.error('Error saving progress:', error);
            alert('Failed to save progress.');
        }
    }

    restart() {
        if (confirm('Are you sure you want to start a new assessment? Your current progress will be lost.')) {
            localStorage.removeItem('ouhsc_research_navigator_progress');
            location.reload();
        }
    }

    showQuestionScreen() {
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('questionScreen').style.display = 'grid';
        document.getElementById('summaryScreen').style.display = 'none';
        document.getElementById('restartBtn').style.display = 'inline-flex';
        document.getElementById('saveProgressBtn').style.display = 'inline-flex';
    }

    displayQuestion(question) {
        const content = document.getElementById('questionContent');
        content.innerHTML = '';

        // Question title
        const title = document.createElement('h2');
        title.className = 'question-title';
        title.textContent = question.text;
        content.appendChild(title);

        // Help text if available
        if (question.helpText) {
            const help = document.createElement('div');
            help.className = 'question-help';
            help.innerHTML = `<strong>&#8505;&#65039; Note:</strong> ${question.helpText}`;
            content.appendChild(help);
        }

        // Render question based on type
        if (question.type === 'boolean') {
            this.renderBooleanQuestion(question, content);
        } else if (question.type === 'single_choice') {
            this.renderSingleChoiceQuestion(question, content);
        } else if (question.type === 'checkbox') {
            this.renderCheckboxQuestion(question, content);
        } else if (question.type === 'summary') {
            this.renderSummaryQuestion(question, content);
        } else if (question.type === 'info') {
            this.renderInfoQuestion(question, content);
        }

        // Update progress
        this.updateProgress();

        // Update navigation buttons
        this.updateNavigationButtons(question);
    }

    renderBooleanQuestion(question, container) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'question-options';

        question.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-button';
            button.textContent = option;

            if (this.answers[question.id] === option) {
                button.classList.add('selected');
            }

            button.addEventListener('click', () => {
                this.selectOption(question.id, option, question);
                // Update UI
                optionsDiv.querySelectorAll('.option-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
                button.classList.add('selected');

                // Enable next button
                document.getElementById('nextBtn').style.display = 'inline-flex';
                document.getElementById('nextBtn').disabled = false;
            });

            optionsDiv.appendChild(button);
        });

        container.appendChild(optionsDiv);
    }

    renderSingleChoiceQuestion(question, container) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'question-options';

        question.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-button';
            button.textContent = option;

            if (this.answers[question.id] === option) {
                button.classList.add('selected');
            }

            button.addEventListener('click', () => {
                this.selectOption(question.id, option, question);
                // Update UI
                optionsDiv.querySelectorAll('.option-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
                button.classList.add('selected');

                // Enable next button
                document.getElementById('nextBtn').style.display = 'inline-flex';
                document.getElementById('nextBtn').disabled = false;
            });

            optionsDiv.appendChild(button);
        });

        container.appendChild(optionsDiv);
    }

    renderCheckboxQuestion(question, container) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'question-options';

        const selectedOptions = this.answers[question.id] || [];

        question.options.forEach(option => {
            const label = document.createElement('label');
            label.className = 'checkbox-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = option;
            checkbox.checked = selectedOptions.includes(option);

            checkbox.addEventListener('change', () => {
                this.selectCheckboxOption(question.id, option, checkbox.checked, question);
                label.classList.toggle('selected', checkbox.checked);

                // Enable next button if at least one option selected
                const hasSelection = this.answers[question.id] && this.answers[question.id].length > 0;
                document.getElementById('nextBtn').disabled = !hasSelection;
                if (hasSelection) {
                    document.getElementById('nextBtn').style.display = 'inline-flex';
                }
            });

            if (selectedOptions.includes(option)) {
                label.classList.add('selected');
            }

            const text = document.createElement('span');
            text.textContent = option;

            label.appendChild(checkbox);
            label.appendChild(text);
            optionsDiv.appendChild(label);
        });

        container.appendChild(optionsDiv);

        // Enable next button if options already selected
        if (selectedOptions.length > 0) {
            document.getElementById('nextBtn').style.display = 'inline-flex';
            document.getElementById('nextBtn').disabled = false;
        }
    }

    renderSummaryQuestion(question, container) {
        const info = document.createElement('div');
        info.className = 'info-box';
        info.innerHTML = `<p>You've completed all the questions! Click "View My Checklist" below to see your personalized compliance checklist.</p>`;
        container.appendChild(info);
    }

    renderInfoQuestion(question, container) {
        const info = document.createElement('div');
        info.className = 'info-box';
        info.innerHTML = `<p>${question.content}</p>`;
        container.appendChild(info);
    }

    selectOption(questionId, option, question) {
        this.answers[questionId] = option;
        this.addToChecklist(question, option);
        this.updateLiveChecklist();
        this.saveProgress();
    }

    selectCheckboxOption(questionId, option, checked, question) {
        if (!this.answers[questionId]) {
            this.answers[questionId] = [];
        }

        if (checked) {
            if (!this.answers[questionId].includes(option)) {
                this.answers[questionId].push(option);
            }
        } else {
            this.answers[questionId] = this.answers[questionId].filter(o => o !== option);
        }

        this.addToChecklist(question, this.answers[questionId]);
        this.updateLiveChecklist();
        this.saveProgress();
    }

    addToChecklist(question, answer) {
        // Remove existing items from this question
        this.checklist = this.checklist.filter(item => item.questionId !== question.id);

        // Add new items based on answer
        if (question.checklistItems) {
            if (Array.isArray(answer)) {
                // Checkbox question
                answer.forEach(selectedOption => {
                    if (question.checklistItems[selectedOption]) {
                        question.checklistItems[selectedOption].forEach(item => {
                            this.checklist.push({
                                ...item,
                                questionId: question.id,
                                questionText: question.text
                            });
                        });
                    }
                });
            } else {
                // Single choice or boolean
                if (question.checklistItems[answer]) {
                    question.checklistItems[answer].forEach(item => {
                        this.checklist.push({
                            ...item,
                            questionId: question.id,
                            questionText: question.text
                        });
                    });
                }
            }
        }

        // Sort by order if specified
        this.checklist.sort((a, b) => (a.order || 999) - (b.order || 999));
    }

    updateLiveChecklist() {
        const container = document.getElementById('liveChecklist');
        container.innerHTML = '';

        if (this.checklist.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No items yet...</p></div>';
            return;
        }

        this.checklist.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `checklist-item ${this.getPriorityClass(item.priority)}`;

            const header = document.createElement('div');
            header.className = 'checklist-item-header';
            header.innerHTML = `
                ${this.getPriorityBadge(item.priority)}
                <span>${item.text}</span>
            `;

            itemDiv.appendChild(header);
            container.appendChild(itemDiv);
        });
    }

    getPriorityClass(priority) {
        if (!priority) return '';
        const normalized = priority.toLowerCase().replace(/\s+/g, '-');
        return `priority-${normalized}`;
    }

    getPriorityBadge(priority) {
        if (!priority) return '';

        const badges = {
            'REQUIRED': '\uD83D\uDD34',
            'REQUIRED BEFORE IRB': '\uD83D\uDD34',
            'REQUIRED BEFORE AWARD ACCEPTANCE': '\uD83D\uDD34',
            'REQUIRED IN PROTOCOL': '\uD83D\uDD34',
            'REQUIRED FOR APPLICABLE TRIALS': '\uD83D\uDD34',
            'CRITICAL': '\u26A0\uFE0F',
            'RECOMMENDED': '\uD83D\uDD35'
        };

        return badges[priority] || '\u2022';
    }

    updateProgress() {
        const totalQuestions = this.decisionTree.questions.filter(q =>
            !['info', 'summary'].includes(q.type)
        ).length;
        const currentIndex = this.questionHistory.length + 1;

        document.getElementById('currentQuestion').textContent = currentIndex;
        document.getElementById('totalQuestions').textContent = totalQuestions;

        const percentage = (currentIndex / totalQuestions) * 100;
        document.getElementById('progressFill').style.width = `${percentage}%`;
    }

    updateNavigationButtons(question) {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const finishBtn = document.getElementById('finishBtn');

        // Previous button
        prevBtn.style.display = this.questionHistory.length > 0 ? 'inline-flex' : 'none';

        // Next/Finish buttons
        if (question.type === 'summary' || question.routing === 'summary') {
            nextBtn.style.display = 'none';
            finishBtn.style.display = 'inline-flex';
        } else if (question.type === 'info' || (question.routing && typeof question.routing === 'string')) {
            nextBtn.style.display = 'inline-flex';
            nextBtn.disabled = false;
            finishBtn.style.display = 'none';
        } else {
            // For checkbox questions with object routing (like q3), check array length
            let hasAnswer = this.answers[question.id] !== undefined;
            if (Array.isArray(this.answers[question.id])) {
                hasAnswer = this.answers[question.id].length > 0;
            }
            nextBtn.style.display = hasAnswer ? 'inline-flex' : 'none';
            nextBtn.disabled = !hasAnswer;
            finishBtn.style.display = 'none';
        }
    }

    nextQuestion() {
        const currentQuestion = this.findQuestionById(this.currentQuestionId);

        // Save to history with pendingRoutes snapshot
        this.questionHistory.push({
            questionId: this.currentQuestionId,
            answer: this.answers[this.currentQuestionId],
            pendingRoutes: [...this.pendingRoutes]
        });

        // Determine next question
        const nextQuestionId = this.getNextQuestionId(currentQuestion);

        if (nextQuestionId === 'summary') {
            this.showSummary();
            return;
        }

        if (nextQuestionId === 'end_determination') {
            // Special handling for determination endpoint
            this.showSummary();
            return;
        }

        const nextQuestion = this.findQuestionById(nextQuestionId);
        if (nextQuestion) {
            this.currentQuestionId = nextQuestionId;
            this.displayQuestion(nextQuestion);

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            this.showSummary();
        }

        this.saveProgress();
    }

    previousQuestion() {
        if (this.questionHistory.length === 0) return;

        const previous = this.questionHistory.pop();
        this.currentQuestionId = previous.questionId;
        this.pendingRoutes = previous.pendingRoutes || [];

        const question = this.findQuestionById(this.currentQuestionId);
        this.displayQuestion(question);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        this.saveProgress();
    }

    getNextQuestionId(question) {
        // Special handling for q3 multi-select study type
        if (question.id === 'q3_study_type') {
            const selected = this.answers[question.id] || [];
            const routeMap = question.routing;

            // IDs that are endpoint pages (info type, not substantive question paths)
            const endpointIds = ['q_qi', 'q_contact_irb'];

            // Build ordered route queue from selected options (preserving options array order)
            const routes = [];
            question.options.forEach(opt => {
                if (selected.includes(opt)) {
                    const routeId = routeMap[opt];
                    if (endpointIds.includes(routeId)) {
                        // Inject endpoint checklist items directly without visiting
                        const endpointQ = this.findQuestionById(routeId);
                        if (endpointQ && endpointQ.checklistItems) {
                            const items = Array.isArray(endpointQ.checklistItems)
                                ? endpointQ.checklistItems
                                : [];
                            items.forEach(item => {
                                if (!this.checklist.some(ci => ci.text === item.text)) {
                                    this.checklist.push({
                                        ...item,
                                        questionId: endpointQ.id,
                                        questionText: endpointQ.text
                                    });
                                }
                            });
                        }
                    } else if (!routes.includes(routeId)) {
                        routes.push(routeId);
                    }
                }
            });

            // Clean stale answers/items from deselected sub-questions
            const allSubQuestionIds = ['q4_retro_phi', 'q5_intervention', 'q6_observational', 'q6_biospecimen'];
            allSubQuestionIds.forEach(qId => {
                if (!routes.includes(qId)) {
                    delete this.answers[qId];
                    this.checklist = this.checklist.filter(item => item.questionId !== qId);
                }
            });
            // Also clean endpoint items if those endpoints are no longer selected
            ['q_qi', 'q_contact_irb'].forEach(epId => {
                const epRouteSelected = selected.some(opt => routeMap[opt] === epId);
                if (!epRouteSelected) {
                    this.checklist = this.checklist.filter(item => item.questionId !== epId);
                }
            });

            if (routes.length === 0) {
                return 'end_determination';
            }

            // Store remaining routes after the first
            this.pendingRoutes = routes.slice(1);
            return routes[0];
        }

        // Skip q9b_oncore_setup if user selected only "None of the above" on q9_oncore
        if (question.id === 'q9_oncore') {
            const q9Answer = this.answers['q9_oncore'] || [];
            const onlyNone = q9Answer.length === 1 && q9Answer[0] === 'None of the above';
            if (onlyNone) {
                return 'q10_final';
            }
        }

        // Determine normal next question ID
        let nextId;
        if (!question.routing) {
            nextId = 'summary';
        } else if (typeof question.routing === 'string') {
            nextId = question.routing;
        } else {
            const answer = this.answers[question.id];
            if (Array.isArray(answer)) {
                nextId = question.routing[answer[0]] || 'summary';
            } else {
                nextId = question.routing[answer] || 'summary';
            }
        }

        // Override with pending routes when leaving a study-type sub-question
        const subQuestionIds = ['q4_retro_phi', 'q5_intervention', 'q6_observational', 'q6_biospecimen'];
        if (this.pendingRoutes.length > 0 && subQuestionIds.includes(question.id)) {
            return this.pendingRoutes.shift();
        }

        return nextId;
    }

    findQuestionById(id) {
        return this.decisionTree.questions.find(q => q.id === id);
    }

    showSummary() {
        document.getElementById('questionScreen').style.display = 'none';
        document.getElementById('summaryScreen').style.display = 'block';

        this.renderSummary();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderSummary() {
        const container = document.getElementById('summaryContent');
        container.innerHTML = '';

        // Collect all checklist items
        const allItems = [...this.checklist];

        // Add fixed items from final question (deduplicated)
        const finalQuestion = this.findQuestionById('q10_final');
        if (finalQuestion && finalQuestion.fixedChecklistItems) {
            finalQuestion.fixedChecklistItems.forEach(item => {
                if (!allItems.some(ai => ai.text === item.text)) {
                    allItems.push({ ...item, questionId: 'q10_final' });
                }
            });
        }

        // Get phase definitions
        const phases = (this.decisionTree.metadata && this.decisionTree.metadata.timelinePhases) || [];

        if (phases.length === 0) {
            // Fallback: render flat list if no phase data
            this.renderFlatSummary(container, allItems);
            return;
        }

        // Phase icon map
        const phaseIcons = {
            'graduation-cap': '\uD83C\uDF93',
            'clipboard-check': '\uD83D\uDCCB',
            'file-text': '\uD83D\uDCC4',
            'rocket': '\uD83D\uDE80'
        };

        // Group items by phase
        const phaseGroups = {};
        allItems.forEach(item => {
            const phase = item.phase !== undefined ? item.phase : 2; // default to regulatory
            if (!phaseGroups[phase]) phaseGroups[phase] = [];
            phaseGroups[phase].push(item);
        });

        // Build Gantt container
        const gantt = document.createElement('div');
        gantt.className = 'gantt-timeline';

        phases.forEach(phaseDef => {
            const items = phaseGroups[phaseDef.id];
            if (!items || items.length === 0) return;

            const phaseDiv = document.createElement('div');
            phaseDiv.className = 'gantt-phase';

            // Phase header
            const header = document.createElement('div');
            header.className = 'gantt-phase-header';
            const icon = phaseIcons[phaseDef.icon] || '\u2022';
            header.innerHTML = `
                <div class="gantt-phase-number">${phaseDef.id}</div>
                <div class="gantt-phase-info">
                    <h4>${icon} ${phaseDef.name}</h4>
                    <p>${phaseDef.note}</p>
                </div>
            `;
            phaseDiv.appendChild(header);

            // Group by track within phase
            const trackGroups = {};
            items.forEach(item => {
                const track = item.track || 'Z';
                if (!trackGroups[track]) trackGroups[track] = [];
                trackGroups[track].push(item);
            });

            const tracksDiv = document.createElement('div');
            tracksDiv.className = 'gantt-tracks' + (phaseDef.parallel ? ' parallel' : '');

            Object.keys(trackGroups).sort().forEach(trackKey => {
                const trackItems = trackGroups[trackKey];

                const trackDiv = document.createElement('div');
                trackDiv.className = 'gantt-track';

                trackItems.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'gantt-track-item';

                    // Title with duration badge
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'gantt-track-title';
                    const isRequired = item.priority && (item.priority.includes('REQUIRED') || item.priority.includes('CRITICAL'));
                    const badgeClass = isRequired ? 'required' : 'recommended';
                    titleDiv.innerHTML = `
                        <span class="gantt-item-text">${item.text}</span>
                        ${item.duration ? `<span class="gantt-duration-badge ${badgeClass}">${item.duration}</span>` : ''}
                    `;
                    itemDiv.appendChild(titleDiv);

                    // Meta (contact, link)
                    if (item.contact || item.link) {
                        const meta = document.createElement('div');
                        meta.className = 'gantt-track-meta';
                        if (item.contact) {
                            const contactSpan = document.createElement('span');
                            contactSpan.textContent = item.contact;
                            meta.appendChild(contactSpan);
                        }
                        if (item.link) {
                            const linkEl = document.createElement('a');
                            linkEl.href = item.link;
                            linkEl.target = '_blank';
                            linkEl.textContent = 'More Info';
                            meta.appendChild(linkEl);
                        }
                        itemDiv.appendChild(meta);
                    }

                    // Note
                    if (item.note) {
                        const note = document.createElement('p');
                        note.className = 'gantt-track-note';
                        note.textContent = item.note;
                        itemDiv.appendChild(note);
                    }

                    // Details / sub-items
                    if (item.details && item.details.length > 0) {
                        const subItems = document.createElement('ul');
                        subItems.className = 'gantt-sub-items';
                        item.details.forEach(d => {
                            const li = document.createElement('li');
                            li.textContent = d;
                            subItems.appendChild(li);
                        });
                        itemDiv.appendChild(subItems);
                    }

                    trackDiv.appendChild(itemDiv);
                });

                tracksDiv.appendChild(trackDiv);
            });

            phaseDiv.appendChild(tracksDiv);

            // Add concurrency note for parallel phases
            if (phaseDef.parallel) {
                const noteDiv = document.createElement('div');
                noteDiv.className = 'gantt-concurrency-note';
                noteDiv.innerHTML = `<strong>Note:</strong> ${phaseDef.note}`;
                phaseDiv.appendChild(noteDiv);
            }

            gantt.appendChild(phaseDiv);
        });

        container.appendChild(gantt);

        // Add timeline estimate after Gantt
        const timeline = this.createTimelineSection();
        container.appendChild(timeline);
    }

    renderFlatSummary(container, allItems) {
        // Fallback flat rendering (same as original)
        const criticalItems = allItems.filter(item =>
            item.priority && (item.priority.includes('CRITICAL') || item.priority.includes('REQUIRED'))
        );
        const recommendedItems = allItems.filter(item =>
            item.priority && item.priority.includes('RECOMMENDED')
        );

        criticalItems.sort((a, b) => (a.order || 999) - (b.order || 999));
        recommendedItems.sort((a, b) => (a.order || 999) - (b.order || 999));

        if (criticalItems.length > 0) {
            const section = this.createSummarySection('Required Actions', criticalItems, '\uD83D\uDD34');
            container.appendChild(section);
        }
        if (recommendedItems.length > 0) {
            const section = this.createSummarySection('Recommended Actions', recommendedItems, '\uD83D\uDD35');
            container.appendChild(section);
        }

        const timeline = this.createTimelineSection();
        container.appendChild(timeline);
    }

    createSummarySection(title, items, icon) {
        const section = document.createElement('div');
        section.className = 'summary-section';

        const heading = document.createElement('h3');
        heading.innerHTML = `${icon} ${title}`;
        section.appendChild(heading);

        items.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'summary-item';

            // Title
            const titleDiv = document.createElement('div');
            titleDiv.className = 'summary-item-title';
            titleDiv.innerHTML = `${index + 1}. ${item.text}`;
            itemDiv.appendChild(titleDiv);

            // Meta information
            const metaDiv = document.createElement('div');
            metaDiv.className = 'summary-item-meta';

            if (item.timeline) {
                const timelineMeta = document.createElement('div');
                timelineMeta.className = 'meta-item';
                timelineMeta.innerHTML = `\u23F1\uFE0F ${item.timeline}`;
                metaDiv.appendChild(timelineMeta);
            }

            if (item.contact) {
                const contactMeta = document.createElement('div');
                contactMeta.className = 'meta-item';
                contactMeta.innerHTML = `\uD83D\uDCDE ${item.contact}`;
                metaDiv.appendChild(contactMeta);
            }

            if (item.link) {
                const linkMeta = document.createElement('div');
                linkMeta.className = 'meta-item';
                linkMeta.innerHTML = `<a href="${item.link}" target="_blank">\uD83D\uDD17 More Info</a>`;
                metaDiv.appendChild(linkMeta);
            }

            if (metaDiv.children.length > 0) {
                itemDiv.appendChild(metaDiv);
            }

            // Note
            if (item.note) {
                const note = document.createElement('p');
                note.style.marginTop = '0.5rem';
                note.style.fontStyle = 'italic';
                note.textContent = item.note;
                itemDiv.appendChild(note);
            }

            // Details
            if (item.details && item.details.length > 0) {
                const detailsDiv = document.createElement('div');
                detailsDiv.className = 'summary-item-details';

                const detailsTitle = document.createElement('strong');
                detailsTitle.textContent = 'Required items:';
                detailsDiv.appendChild(detailsTitle);

                const list = document.createElement('ul');
                item.details.forEach(detail => {
                    const li = document.createElement('li');
                    li.textContent = detail;
                    list.appendChild(li);
                });
                detailsDiv.appendChild(list);
                itemDiv.appendChild(detailsDiv);
            }

            section.appendChild(itemDiv);
        });

        return section;
    }

    createTimelineSection() {
        const section = document.createElement('div');
        section.className = 'summary-section';

        const heading = document.createElement('h3');
        heading.innerHTML = '\uD83D\uDCC5 Estimated Timeline';
        section.appendChild(heading);

        const info = document.createElement('div');
        info.className = 'info-box';

        let timelineHTML = '<p>Based on your study characteristics, here\'s a rough timeline:</p><ul>';

        const hasCancerReview = this.checklist.some(item => item.text.includes('PRMC') || item.text.includes('Cancer Center'));
        const hasIND = this.checklist.some(item => item.text.includes('IND'));
        const hasFunding = this.checklist.some(item => item.text.includes('ORA'));

        if (hasCancerReview) {
            timelineHTML += '<li><strong>Cancer Center Reviews:</strong> 2-3 months</li>';
        }
        if (hasIND) {
            timelineHTML += '<li><strong>IND Preparation & FDA Review:</strong> 3-6 months</li>';
        }
        if (hasFunding) {
            timelineHTML += '<li><strong>Grant Submission:</strong> Allow 5 days before sponsor deadline</li>';
        }

        timelineHTML += '<li><strong>IRB Review:</strong> 2-6 weeks depending on review type</li>';
        timelineHTML += '</ul>';
        timelineHTML += '<p><strong>Total estimated time from start to IRB approval:</strong> ';

        let totalMonths = 1;
        if (hasCancerReview) totalMonths += 2.5;
        if (hasIND) totalMonths += 4;

        timelineHTML += `${totalMonths}-${totalMonths + 2} months</p>`;

        info.innerHTML = timelineHTML;
        section.appendChild(info);

        return section;
    }

    printChecklist() {
        window.print();
    }

    exportPDF() {
        // For SharePoint deployment, we'll use browser print to PDF
        alert('To save as PDF:\n\n1. Click OK to close this message\n2. Use your browser\'s print function (Ctrl+P or Cmd+P)\n3. Select "Save as PDF" as the printer\n4. Click Save\n\nTip: The checklist is already formatted for clean PDF output!');
        setTimeout(() => window.print(), 500);
    }

    emailChecklist() {
        const subject = encodeURIComponent('OUHSC Research Compliance Checklist');
        let body = 'OUHSC Research Compliance Checklist\n\n';
        body += 'Generated on: ' + new Date().toLocaleDateString() + '\n\n';
        body += '='.repeat(50) + '\n\n';

        // Build text-based Gantt for email
        const allItems = [...this.checklist];
        const finalQuestion = this.findQuestionById('q10_final');
        if (finalQuestion && finalQuestion.fixedChecklistItems) {
            finalQuestion.fixedChecklistItems.forEach(item => {
                if (!allItems.some(ai => ai.text === item.text)) {
                    allItems.push(item);
                }
            });
        }

        const phases = (this.decisionTree.metadata && this.decisionTree.metadata.timelinePhases) || [];

        if (phases.length > 0) {
            const phaseGroups = {};
            allItems.forEach(item => {
                const phase = item.phase !== undefined ? item.phase : 2;
                if (!phaseGroups[phase]) phaseGroups[phase] = [];
                phaseGroups[phase].push(item);
            });

            phases.forEach(phaseDef => {
                const items = phaseGroups[phaseDef.id];
                if (!items || items.length === 0) return;

                body += `--- Phase ${phaseDef.id}: ${phaseDef.name} ---\n`;
                body += `${phaseDef.note}\n\n`;

                items.forEach((item, idx) => {
                    body += `  ${idx + 1}. ${item.text}\n`;
                    if (item.priority) body += `     Priority: ${item.priority}\n`;
                    if (item.duration) body += `     Duration: ${item.duration}\n`;
                    if (item.contact) body += `     Contact: ${item.contact}\n`;
                    if (item.timeline) body += `     Timeline: ${item.timeline}\n`;
                    body += '\n';
                });
                body += '\n';
            });
        } else {
            allItems.forEach((item, index) => {
                body += `${index + 1}. ${item.text}\n`;
                if (item.priority) body += `   Priority: ${item.priority}\n`;
                if (item.contact) body += `   Contact: ${item.contact}\n`;
                if (item.timeline) body += `   Timeline: ${item.timeline}\n`;
                body += '\n';
            });
        }

        body += '\n' + '='.repeat(50) + '\n\n';
        body += 'For questions, contact IRB Office: irb@ouhsc.edu | 405-271-2045\n';
        body += '\n\nGenerated by OUHSC Research Compliance Navigator';

        const mailtoLink = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
    }

    showNotification(message) {
        // Simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem 2rem;
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showError(message) {
        alert(message);
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ResearchNavigator();
});

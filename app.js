// OUHSC Research Compliance Navigator - Main Application
// Author: Geneva Daniel
// Version: 1.0

class ResearchNavigator {
    constructor() {
        this.decisionTree = null;
        this.currentQuestionId = null;
        this.answers = {};
        this.checklist = [];
        this.questionHistory = [];
        
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
            help.innerHTML = `<strong>ℹ️ Note:</strong> ${question.helpText}`;
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
            'REQUIRED': '🔴',
            'REQUIRED BEFORE IRB': '🔴',
            'REQUIRED BEFORE AWARD ACCEPTANCE': '🔴',
            'REQUIRED IN PROTOCOL': '🔴',
            'REQUIRED FOR APPLICABLE TRIALS': '🔴',
            'CRITICAL': '⚠️',
            'RECOMMENDED': '🔵'
        };
        
        return badges[priority] || '•';
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
            const hasAnswer = this.answers[question.id] !== undefined;
            nextBtn.style.display = hasAnswer ? 'inline-flex' : 'none';
            nextBtn.disabled = !hasAnswer;
            finishBtn.style.display = 'none';
        }
    }

    nextQuestion() {
        const currentQuestion = this.findQuestionById(this.currentQuestionId);
        
        // Save to history
        this.questionHistory.push({
            questionId: this.currentQuestionId,
            answer: this.answers[this.currentQuestionId]
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
        
        const question = this.findQuestionById(this.currentQuestionId);
        this.displayQuestion(question);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        this.saveProgress();
    }

    getNextQuestionId(question) {
        if (!question.routing) return 'summary';
        
        if (typeof question.routing === 'string') {
            return question.routing;
        }
        
        const answer = this.answers[question.id];
        
        if (Array.isArray(answer)) {
            // Checkbox - use first selected option's routing
            return question.routing[answer[0]] || question.routing;
        }
        
        return question.routing[answer] || 'summary';
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
        
        // Group checklist items by priority
        const criticalItems = this.checklist.filter(item => 
            item.priority && (item.priority.includes('CRITICAL') || item.priority.includes('REQUIRED'))
        );
        const recommendedItems = this.checklist.filter(item => 
            item.priority && item.priority.includes('RECOMMENDED')
        );
        
        // Add fixed items from final question
        const finalQuestion = this.decisionTree.questions.find(q => q.id === 'q10_final');
        if (finalQuestion && finalQuestion.fixedChecklistItems) {
            finalQuestion.fixedChecklistItems.forEach(item => {
                if (!criticalItems.some(ci => ci.text === item.text)) {
                    criticalItems.push(item);
                }
            });
        }
        
        // Sort by order
        criticalItems.sort((a, b) => (a.order || 999) - (b.order || 999));
        recommendedItems.sort((a, b) => (a.order || 999) - (b.order || 999));
        
        // Required/Critical section
        if (criticalItems.length > 0) {
            const section = this.createSummarySection('Required Actions', criticalItems, '🔴');
            container.appendChild(section);
        }
        
        // Recommended section
        if (recommendedItems.length > 0) {
            const section = this.createSummarySection('Recommended Actions', recommendedItems, '🔵');
            container.appendChild(section);
        }
        
        // Timeline estimate
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
                timelineMeta.innerHTML = `⏱️ ${item.timeline}`;
                metaDiv.appendChild(timelineMeta);
            }
            
            if (item.contact) {
                const contactMeta = document.createElement('div');
                contactMeta.className = 'meta-item';
                contactMeta.innerHTML = `📞 ${item.contact}`;
                metaDiv.appendChild(contactMeta);
            }
            
            if (item.link) {
                const linkMeta = document.createElement('div');
                linkMeta.className = 'meta-item';
                linkMeta.innerHTML = `<a href="${item.link}" target="_blank">🔗 More Info</a>`;
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
        heading.innerHTML = '📅 Estimated Timeline';
        section.appendChild(heading);
        
        const info = document.createElement('div');
        info.className = 'info-box';
        
        let timelineHTML = '<p>Based on your study characteristics, here\'s a rough timeline:</p><ul>';
        
        const hasCancerReview = this.checklist.some(item => item.text.includes('PRMC'));
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
        
        this.checklist.forEach((item, index) => {
            body += `${index + 1}. ${item.text}\n`;
            if (item.priority) body += `   Priority: ${item.priority}\n`;
            if (item.contact) body += `   Contact: ${item.contact}\n`;
            if (item.timeline) body += `   Timeline: ${item.timeline}\n`;
            body += '\n';
        });
        
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

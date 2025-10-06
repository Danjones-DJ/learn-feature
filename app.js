// OpenAI API Configuration
const OPENAI_API_KEY = key;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Global variables
let recognition = null;
let isRecording = false;

console.log('App.js loaded successfully');

// ===========================================
// NAVIGATION
// ===========================================
function showMode(mode) {
    document.querySelectorAll('.mode-page').forEach(page => {
        page.classList.remove('active');
    });
    
    if (mode === 'home') {
        document.getElementById('home-page').classList.add('active');
    } else {
        document.getElementById(mode + '-page').classList.add('active');
    }
}

// ===========================================
// SPEECH RECOGNITION SETUP
// ===========================================
function initSpeechRecognition() {
    console.log('Initializing speech recognition...');
    
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
        recognition = new SpeechRecognition();
    } else {
        console.error('Speech recognition NOT supported in this browser');
        return;
    }
    
    // ADD THESE LINES FOR BETTER ACCURACY:
    recognition.continuous = true;
    recognition.interimResults = true;        
    recognition.maxAlternatives = 3;  // Get multiple alternatives
    recognition.lang = 'en-GB';  // British English (change from 'en-US')

    
    console.log('Speech recognition configured');

    recognition.onstart = () => {
        console.log('Speech recognition STARTED');
    };

    recognition.onresult = (event) => {
        console.log('Speech recognition result received');
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            }
        }
        
        if (finalTranscript) {
            const textarea = document.getElementById('blurt-explanation');
            textarea.value += finalTranscript;
            console.log('Transcribed:', finalTranscript);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopRecording();
        alert('Speech recognition error: ' + event.error);
    };

    recognition.onend = () => {
        console.log('Speech recognition ended, isRecording:', isRecording);
        if (isRecording) {
            console.log('Restarting recognition...');
            recognition.start();
        }
    };
}

// ===========================================
// RECORDING CONTROLS
// ===========================================
function toggleRecording() {
    console.log('toggleRecording called, isRecording:', isRecording);
    
    if (!recognition) {
        console.error('Recognition not initialized');
        alert('Speech recognition is not supported in your browser. Please use Chrome and type your explanation instead.');
        return;
    }

    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    console.log('Starting recording...');
    isRecording = true;
    
    try {
        recognition.start();
        console.log('Recognition.start() called');
    } catch (error) {
        console.error('Error starting recognition:', error);
    }
    
    const recordBtn = document.querySelector('#blurt-page .btn-secondary');
    if (recordBtn) {
        recordBtn.textContent = '⏹️ Stop Recording';
        recordBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        recordBtn.style.color = '#ffffff';
        recordBtn.style.borderColor = '#ef4444';
    }
}

function stopRecording() {
    console.log('Stopping recording...');
    isRecording = false;
    if (recognition) {
        recognition.stop();
    }
    
    const recordBtn = document.querySelector('#blurt-page .btn-secondary');
    if (recordBtn) {
        recordBtn.textContent = 'Start Recording';
        recordBtn.style.background = '#ffffff';
        recordBtn.style.color = '#6366f1';
        recordBtn.style.borderColor = '#6366f1';
    }
}

// ===========================================
// PDF PARSING
// ===========================================
async function parsePDF(file) {
    console.log('Parsing PDF...');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const typedarray = new Uint8Array(e.target.result);
                
                if (typeof pdfjsLib === 'undefined') {
                    throw new Error('PDF.js not loaded');
                }
                
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n';
                }
                
                console.log('PDF parsed successfully, length:', fullText.length);
                resolve(fullText);
            } catch (error) {
                console.error('PDF parsing error:', error);
                reject(error);
            }
        };
        
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ===========================================
// FILE HANDLING
// ===========================================
async function handleReferenceFile() {
    console.log('handleReferenceFile called');
    const fileInput = document.getElementById('blurt-file');
    const textArea = document.getElementById('blurt-reference');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        console.log('File selected:', file.name, file.type);
        
        textArea.value = 'Loading file...';
        textArea.disabled = true;
        
        try {
            let content = '';
            if (file.type === 'application/pdf') {
                content = await parsePDF(file);
            } else {
                content = await file.text();
            }
            
            textArea.value = content;
            textArea.disabled = false;
            console.log('File loaded successfully');
        } catch (error) {
            console.error('Error reading file:', error);
            textArea.value = '';
            textArea.disabled = false;
            alert('Error reading file: ' + error.message);
        }
    }
}

// ===========================================
// OPENAI API CALL
// ===========================================
async function callOpenAI(systemPrompt, userPrompt) {
    console.log('Calling OpenAI API...');
    console.log('System prompt length:', systemPrompt.length);
    console.log('User prompt length:', userPrompt.length);
    
    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.5,
                max_tokens: 2000
            })
        });

        console.log('API response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API error data:', errorData);
            throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        console.log('API response received successfully');
        return data.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw error;
    }
}

// ===========================================
// ANALYZE BLURT
// ===========================================
async function analyzeBlurt() {
    console.log('=== analyzeBlurt CALLED ===');
    
    const referenceText = document.getElementById('blurt-reference').value.trim();
    const blurtText = document.getElementById('blurt-explanation').value.trim();
    const resultsDiv = document.getElementById('blurt-results');
    const analyzeBtn = document.getElementById('analyse-blurt-btn') || document.querySelector('#blurt-page .btn-primary');
    
    console.log('Reference text length:', referenceText.length);
    console.log('Blurt text length:', blurtText.length);
    console.log('Results div found:', !!resultsDiv);
    console.log('Button found:', !!analyzeBtn);
    
    // Validation
    if (!referenceText) {
        alert('Please upload reference material or paste lecture notes.');
        return;
    }
    
    if (!blurtText) {
        alert('Please provide your explanation by recording or typing.');
        return;
    }
    
    // Show loading state
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analysing...';
    }
    
    if (resultsDiv) {
        resultsDiv.style.display = 'block';
        resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="spinner"></div>
                <p style="margin-top: 20px; color: #6a6a6a;">Analysing your understanding...</p>
            </div>
        `;
    }
    
    try {
        console.log('Preparing API call...');
        
        const systemPrompt = `You are an expert educational assessor who provides constructive, detailed feedback on student understanding. You compare student explanations to reference material and provide scores and actionable feedback. 

IMPORTANT: Students often focus on specific sections or concepts from the reference material rather than attempting to cover everything at once. Your assessment should:
1. Identify which specific topic/section the student is explaining
2. Evaluate their understanding of THAT specific topic only
3. NOT penalize them for not covering unrelated sections
4. Do NOT expect them to use every key word - if they are able to explain well the idea, they should not be penalised for missing terminology
5. Be more generous in marking if it is apparent that a student understands the key ideas and concepts or links between the ideas.
6. Penalise MAINLY for things that are wrong - for example, wrong conclusions, or wrong definitions.
7. Score them based on depth and accuracy of what they DID explain, not breadth of coverage`;
        
        const userPrompt = `Compare the student's explanation to the reference material and provide a detailed assessment.

REFERENCE MATERIAL:
${referenceText}

STUDENT'S EXPLANATION:
${blurtText}

ASSESSMENT GUIDELINES:
- First identify which specific topic or section from the reference material the student is addressing
- Score them ONLY on their understanding of that specific topic (0-100)
- Do NOT deduct points for not covering other topics in the reference material
- Do NOT deduct points for grammar and spelling
- Focus on: accuracy, depth of understanding, correct use of terminology, logical flow - however, do not penalise them for not absolutely defining or linking a term, so far as they explain the idea and overarching concept well
- Penalise MAINLY for things that are wrong - for example, wrong conclusions, or wrong definitions
- If they're explaining multiple topics, assess their understanding across those topics only

Provide your response in the following JSON format ONLY:
{
  "score": 75,
  "topic_addressed": "brief description of what topic/section they explained",
  "understood": ["point 1", "point 2", "point 3"],
  "missed": ["point 1 from the topic they addressed", "point 2 from the topic they addressed"],
  "misunderstood": ["misconception 1 if any"],
  "focus_areas": ["area 1 to improve within this topic", "area 2", "area 3"]
}

Be thorough but fair. The score should reflect how well they understood the SPECIFIC concepts they attempted to explain.`;

        const response = await callOpenAI(systemPrompt, userPrompt);
        console.log('Raw API response:', response);
        
        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('No JSON found in response');
            throw new Error('Invalid response format from API');
        }
        
        console.log('JSON extracted:', jsonMatch[0]);
        const analysis = JSON.parse(jsonMatch[0]);
        console.log('Parsed analysis:', analysis);
        
        displayBlurtResults(analysis);
        
    } catch (error) {
        console.error('Error in analyzeBlurt:', error);
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <p style="color: #ef4444; font-weight: 600;">Error analysing your response</p>
                    <p style="color: #6a6a6a; margin-top: 8px;">${error.message}</p>
                    <p style="color: #999; margin-top: 8px; font-size: 12px;">Check the browser console for more details</p>
                </div>
            `;
        }
    } finally {
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyse Understanding';
        }
    }
}

// ===========================================
// DISPLAY RESULTS
// ===========================================
function displayBlurtResults(analysis) {
    console.log('Displaying results...');
    const resultsDiv = document.getElementById('blurt-results');
    
    if (!resultsDiv) {
        console.error('Results div not found');
        return;
    }
    
    // Determine score colour
    let scoreColour = '#10b981'; // Green
    if (analysis.score < 60) scoreColour = '#ef4444'; // Red
    else if (analysis.score < 80) scoreColour = '#f59e0b'; // Orange
    
    let html = `
        <div style="text-align: center; margin-bottom: 32px;">
            <div style="font-size: 72px; font-weight: 700; color: ${scoreColour}; margin-bottom: 8px;">
                ${analysis.score}/100
            </div>
            <p style="font-size: 18px; color: #6a6a6a; font-weight: 600;">
                ${analysis.score >= 80 ? 'Excellent understanding!' : analysis.score >= 60 ? 'Good effort, room for improvement' : 'Keep studying, you\'ll get there!'}
            </p>
            ${analysis.topic_addressed ? `<p style="font-size: 14px; color: #999; margin-top: 12px;">Topic assessed: ${analysis.topic_addressed}</p>` : ''}
        </div>
        
        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h4 style="color: #10b981; margin-bottom: 12px; font-size: 16px; font-weight: 700;">✓ What You Understood Well</h4>
            <ul style="margin: 0; padding-left: 20px; color: #121212;">
                ${analysis.understood.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
            </ul>
        </div>
    `;
    
    if (analysis.missed && analysis.missed.length > 0) {
        html += `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="color: #d97706; margin-bottom: 12px; font-size: 16px; font-weight: 700;">⚠ What You Missed</h4>
                <ul style="margin: 0; padding-left: 20px; color: #121212;">
                    ${analysis.missed.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    if (analysis.misunderstood && analysis.misunderstood.length > 0) {
        html += `
            <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4 style="color: #dc2626; margin-bottom: 12px; font-size: 16px; font-weight: 700;">✗ Misconceptions to Address</h4>
                <ul style="margin: 0; padding-left: 20px; color: #121212;">
                    ${analysis.misunderstood.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    html += `
        <div style="background: #ede9fe; border-left: 4px solid #6366f1; padding: 20px; border-radius: 8px;">
            <h4 style="color: #6366f1; margin-bottom: 12px; font-size: 16px; font-weight: 700;">🎯 Focus Areas for Next Time</h4>
            <ul style="margin: 0; padding-left: 20px; color: #121212;">
                ${analysis.focus_areas.map(item => `<li style="margin-bottom: 8px;">${item}</li>`).join('')}
            </ul>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
    console.log('Results displayed successfully');
}

    // ===========================================
    // EVENT LISTENERS
    // ===========================================
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM Content Loaded');
        
        // Initialize speech recognition
        initSpeechRecognition();
        
        // Blurt mode - File upload
        const blurtFileInput = document.getElementById('blurt-file');
        if (blurtFileInput) {
            blurtFileInput.addEventListener('change', handleReferenceFile);
            console.log('File input listener attached');
        }
        
        // Blurt mode - Recording button
        const recordBtn = document.querySelector('#blurt-page .btn-secondary');
        if (recordBtn) {
            recordBtn.addEventListener('click', toggleRecording);
            console.log('Record button listener attached');
        }
        
        // Blurt mode - Analyse button - try multiple selectors
        let analyseBtn = document.getElementById('analyse-blurt-btn');
        if (!analyseBtn) {
            analyseBtn = document.querySelector('#blurt-page .btn-primary');
        }
        
        if (analyseBtn) {
            analyseBtn.addEventListener('click', function(e) {
                console.log('Analyse button clicked!');
                analyzeBlurt();
            });
            console.log('Analyse button listener attached');
        } else {
            console.error('Analyse button NOT FOUND!');
        }
        
        // === BLOOM'S LISTENERS ===
        initBloomsSpeechRecognition();
        
        const bloomsFileInput = document.getElementById('blooms-file');
        if (bloomsFileInput) {
            bloomsFileInput.addEventListener('change', handleBloomsFile);
        }
        
        const generateQuizBtn = document.getElementById('generate-quiz-btn');
        if (generateQuizBtn) {
            generateQuizBtn.addEventListener('click', generateBloomsQuiz);
        }
        
        const bloomsVoiceBtn = document.getElementById('blooms-voice-btn');
        if (bloomsVoiceBtn) {
            bloomsVoiceBtn.addEventListener('click', toggleBloomsRecording);
        }
        
        const bloomsTypeBtn = document.getElementById('blooms-type-btn');
        if (bloomsTypeBtn) {
            bloomsTypeBtn.addEventListener('click', stopBloomsRecording);
        }
        
        const submitAnswerBtn = document.getElementById('submit-answer-btn');
        if (submitAnswerBtn) {
            submitAnswerBtn.addEventListener('click', submitBloomsAnswer);
        }
        
        const skipBtn = document.getElementById('skip-question-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', skipBloomsQuestion);
        }
        
        const followupBtn = document.getElementById('request-followup-btn');
        if (followupBtn) {
            followupBtn.addEventListener('click', requestFollowUp);
        }
        
        const nextBtn = document.getElementById('next-question-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', nextBloomsQuestion);
        }
    });

// Add spinner CSS
if (!document.querySelector('style[data-spinner]')) {
    const style = document.createElement('style');
    style.setAttribute('data-spinner', 'true');
    style.textContent = `
        .spinner {
            border: 4px solid #f3f4f6;
            border-top: 4px solid #6366f1;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    console.log('Spinner styles added');
}

// ===========================================
// BLOOM'S TAXONOMY - QUIZ STATE
// ===========================================
let quizState = {
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: [],
    isInFollowUp: false,
    followUpQuestions: [],
    currentFollowUpIndex: 0,
    lectureContent: ''
};

let bloomsRecognition = null;
let isBloomsRecording = false;

// ===========================================
// BLOOM'S - FILE HANDLING
// ===========================================
async function handleBloomsFile() {
    const fileInput = document.getElementById('blooms-file');
    const textArea = document.getElementById('blooms-text');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        textArea.value = 'Loading file...';
        textArea.disabled = true;
        
        try {
            let content = '';
            if (file.type === 'application/pdf') {
                content = await parsePDF(file);
            } else {
                content = await file.text();
            }
            
            textArea.value = content;
            textArea.disabled = false;
        } catch (error) {
            console.error('Error reading file:', error);
            textArea.value = '';
            textArea.disabled = false;
            alert('Error reading file: ' + error.message);
        }
    }
}

// ===========================================
// BLOOM'S - SPEECH RECOGNITION
// ===========================================
function initBloomsSpeechRecognition() {
    if ('webkitSpeechRecognition' in window) {
        bloomsRecognition = new webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
        bloomsRecognition = new SpeechRecognition();
    } else {
        return;
    }
    
    bloomsRecognition.continuous = true;
    bloomsRecognition.interimResults = true;
    bloomsRecognition.maxAlternatives = 3;
    bloomsRecognition.lang = 'en-GB';

    bloomsRecognition.onresult = (event) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            }
        }
        
        if (finalTranscript) {
            const textarea = document.getElementById('blooms-answer');
            textarea.value += finalTranscript;
        }
    };

    bloomsRecognition.onerror = (event) => {
        console.error('Blooms speech recognition error:', event.error);
        stopBloomsRecording();
    };

    bloomsRecognition.onend = () => {
        if (isBloomsRecording) {
            bloomsRecognition.start();
        }
    };
}

function toggleBloomsRecording() {
    if (!bloomsRecognition) {
        alert('Speech recognition is not supported in your browser.');
        return;
    }

    const voiceBtn = document.getElementById('blooms-voice-btn');
    const typeBtn = document.getElementById('blooms-type-btn');

    if (isBloomsRecording) {
        stopBloomsRecording();
    } else {
        isBloomsRecording = true;
        bloomsRecognition.start();
        voiceBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        voiceBtn.style.color = '#ffffff';
        voiceBtn.style.borderColor = '#ef4444';
        voiceBtn.textContent = '⏹️ Stop';
        
        typeBtn.style.background = '#ffffff';
        typeBtn.style.color = '#6366f1';
        typeBtn.style.borderColor = '#6366f1';
    }
}

function stopBloomsRecording() {
    isBloomsRecording = false;
    if (bloomsRecognition) {
        bloomsRecognition.stop();
    }
    
    const voiceBtn = document.getElementById('blooms-voice-btn');
    voiceBtn.style.background = '#ffffff';
    voiceBtn.style.color = '#6366f1';
    voiceBtn.style.borderColor = '#6366f1';
    voiceBtn.textContent = '🎤 Voice';
}

// ===========================================
// BLOOM'S - GENERATE QUIZ
// ===========================================
async function generateBloomsQuiz() {
    const fileInput = document.getElementById('blooms-file');
    const textInput = document.getElementById('blooms-text').value.trim();
    const numQuestions = parseInt(document.getElementById('num-questions').value);
    
    let content = textInput;
    
    if (fileInput.files.length > 0) {
        try {
            const file = fileInput.files[0];
            if (file.type === 'application/pdf') {
                content = await parsePDF(file);
            } else {
                content = await file.text();
            }
        } catch (error) {
            alert('Error reading file: ' + error.message);
            return;
        }
    }
    
    if (!content) {
        alert('Please upload a file or paste lecture notes.');
        return;
    }
    
    quizState.lectureContent = content;
    
    // Show loading
    const setupDiv = document.getElementById('blooms-setup');
    const generateBtn = document.getElementById('generate-quiz-btn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating Quiz...';
    
    try {
        const systemPrompt = `You are an adaptive quiz generator. You create questions based on Bloom's Taxonomy levels 2-5 (Understand, Apply, Analyse, Evaluate). You MUST return ONLY valid JSON, no other text.`;
        
        const userPrompt = `Based on the following lecture material, create ${numQuestions} short-answer questions distributed across Bloom's Taxonomy levels:
- Understand: ~${Math.ceil(numQuestions * 0.2)} questions
- Apply: ~${Math.ceil(numQuestions * 0.2)} questions  
- Analyse: ~${Math.ceil(numQuestions * 0.3)} questions
- Evaluate: ~${Math.ceil(numQuestions * 0.3)} questions

LECTURE MATERIAL:
${content}

Return ONLY this JSON structure with NO additional text:
{
  "questions": [
    {
      "id": 1,
      "level": "Understand",
      "question": "question text",
      "ideal_answer": "brief ideal answer for comparison"
    }
  ]
}`;

        const response = await callOpenAI(systemPrompt, userPrompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error('Invalid response format from API');
        }
        
        const data = JSON.parse(jsonMatch[0]);
        quizState.questions = data.questions;
        quizState.currentQuestionIndex = 0;
        quizState.userAnswers = [];
        
        // Hide setup, show quiz
        setupDiv.style.display = 'none';
        document.getElementById('blooms-quiz').style.display = 'block';
        
        // Start first question
        displayQuestion();
        
    } catch (error) {
        console.error('Error generating quiz:', error);
        alert('Error generating quiz: ' + error.message);
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Quiz';
    }
}

// ===========================================
// BLOOM'S - DISPLAY QUESTION
// ===========================================
function displayQuestion() {
    const question = quizState.questions[quizState.currentQuestionIndex];
    const chatContainer = document.getElementById('chat-container');
    const progressText = document.getElementById('progress-text');
    const bloomLevelBadge = document.getElementById('bloom-level-badge');
    const progressBar = document.getElementById('progress-bar');
    
    // Update progress
    const progress = ((quizState.currentQuestionIndex + 1) / quizState.questions.length) * 100;
    progressBar.style.width = progress + '%';
    progressText.textContent = `Question ${quizState.currentQuestionIndex + 1} of ${quizState.questions.length}`;
    bloomLevelBadge.textContent = question.level;
    bloomLevelBadge.className = 'bloom-badge bloom-' + question.level.toLowerCase();
    
    // Add question to chat
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message message-system';
    messageDiv.innerHTML = `
        <div class="message-bubble">
            <strong>Question ${quizState.currentQuestionIndex + 1}</strong>
            <span class="bloom-badge bloom-${question.level.toLowerCase()}">${question.level}</span>
            <p style="margin-top: 12px;">${question.question}</p>
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Clear answer input
    document.getElementById('blooms-answer').value = '';
    document.getElementById('answer-input-container').style.display = 'block';
    document.getElementById('action-buttons').style.display = 'none';
}

// ===========================================
// BLOOM'S - SUBMIT ANSWER
// ===========================================
async function submitBloomsAnswer() {
    const answerText = document.getElementById('blooms-answer').value.trim();
    
    if (!answerText) {
        alert('Please provide an answer.');
        return;
    }
    
    const question = quizState.questions[quizState.currentQuestionIndex];
    const chatContainer = document.getElementById('chat-container');
    const submitBtn = document.getElementById('submit-answer-btn');
    
    // Add user answer to chat
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'chat-message message-user';
    userMessageDiv.innerHTML = `
        <div class="message-bubble">
            <strong>Your Answer</strong>
            <p style="margin-top: 8px;">${answerText}</p>
        </div>
    `;
    chatContainer.appendChild(userMessageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analysing...';
    document.getElementById('answer-input-container').style.display = 'none';
    
    try {
        const systemPrompt = `You are an expert educational tutor providing brief, constructive feedback on student answers. Compare answers to the ideal response and provide concise feedback. Do NOT deduct points for not covering other topics in the reference material. Do NOT deduct points for grammar and spelling. Focus on: accuracy, depth of understanding, correct use of terminology, logical flow - however, do not penalise them for not absolutely defining or linking a term, so far as they explain the idea and overarching concept well. Return ONLY valid JSON.`;
        
        const userPrompt = `Compare the student's answer to the ideal answer and provide feedback.

QUESTION (${question.level} level):
${question.question}

IDEAL ANSWER:
${question.ideal_answer}

STUDENT'S ANSWER:
${answerText}

Provide feedback in this JSON format ONLY:
{
  "correctness": "correct|partial|incorrect",
  "feedback": "2-3 sentence feedback explaining what's good and what's missing",
  "key_points_covered": ["point1", "point2"],
  "key_points_missed": ["point1", "point2"]
}`;

        const response = await callOpenAI(systemPrompt, userPrompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const feedback = JSON.parse(jsonMatch[0]);
        
        // Store answer
        quizState.userAnswers.push({
            questionId: question.id,
            answer: answerText,
            feedback: feedback
        });
        
        // Display feedback
        displayFeedback(feedback);
        
    } catch (error) {
        console.error('Error getting feedback:', error);
        alert('Error analysing answer: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Answer';
        document.getElementById('answer-input-container').style.display = 'block';
    }
}

// ===========================================
// BLOOM'S - DISPLAY FEEDBACK
// ===========================================
function displayFeedback(feedback) {
    const chatContainer = document.getElementById('chat-container');
    
    let feedbackClass = 'feedback-correct';
    if (feedback.correctness === 'partial') feedbackClass = 'feedback-partial';
    if (feedback.correctness === 'incorrect') feedbackClass = 'feedback-incorrect';
    
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'chat-message message-system';
    feedbackDiv.innerHTML = `
        <div class="message-bubble ${feedbackClass}">
            <strong>Feedback</strong>
            <p style="margin-top: 8px;">${feedback.feedback}</p>
            ${feedback.key_points_covered && feedback.key_points_covered.length > 0 ? `
                <p style="margin-top: 12px; font-weight: 600;">✓ Points Covered:</p>
                <ul style="margin-left: 20px; margin-top: 4px;">
                    ${feedback.key_points_covered.map(p => `<li>${p}</li>`).join('')}
                </ul>
            ` : ''}
            ${feedback.key_points_missed && feedback.key_points_missed.length > 0 ? `
                <p style="margin-top: 12px; font-weight: 600;">• Points to Consider:</p>
                <ul style="margin-left: 20px; margin-top: 4px;">
                    ${feedback.key_points_missed.map(p => `<li>${p}</li>`).join('')}
                </ul>
            ` : ''}
        </div>
    `;
    chatContainer.appendChild(feedbackDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Show action buttons
    document.getElementById('action-buttons').style.display = 'flex';
    
    // Reset submit button
    const submitBtn = document.getElementById('submit-answer-btn');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Answer';
}

// ===========================================
// BLOOM'S - REQUEST FOLLOW-UP
// ===========================================
async function requestFollowUp() {
    const question = quizState.questions[quizState.currentQuestionIndex];
    const userAnswer = quizState.userAnswers[quizState.userAnswers.length - 1];
    const requestBtn = document.getElementById('request-followup-btn');
    
    requestBtn.disabled = true;
    requestBtn.textContent = 'Generating Follow-ups...';
    
    try {
        const systemPrompt = `You are an adaptive tutor. Generate 3-5 targeted follow-up questions at the same Bloom's level to help the student understand concepts they missed. Return ONLY valid JSON.`;
        
        const userPrompt = `The student answered a ${question.level} level question but missed some points. Generate 3-5 follow-up questions at the same cognitive level to help them understand what they missed.

ORIGINAL QUESTION:
${question.question}

STUDENT'S ANSWER:
${userAnswer.answer}

WHAT THEY MISSED:
${userAnswer.feedback.key_points_missed.join(', ')}

LECTURE CONTEXT:
${quizState.lectureContent.substring(0, 2000)}

Return ONLY this JSON:
{
  "followup_questions": [
    {
      "question": "follow-up question text",
      "guidance": "brief hint or guidance"
    }
  ]
}`;

        const response = await callOpenAI(systemPrompt, userPrompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const data = JSON.parse(jsonMatch[0]);
        
        quizState.followUpQuestions = data.followup_questions;
        quizState.isInFollowUp = true;
        quizState.currentFollowUpIndex = 0;
        
        // Hide action buttons, show first follow-up
        document.getElementById('action-buttons').style.display = 'none';
        displayFollowUpQuestion();
        
    } catch (error) {
        console.error('Error generating follow-ups:', error);
        alert('Error generating follow-up questions: ' + error.message);
        requestBtn.disabled = false;
        requestBtn.textContent = 'Request Follow-up Questions';
    }
}

// ===========================================
// BLOOM'S - DISPLAY FOLLOW-UP
// ===========================================
function displayFollowUpQuestion() {
    const followUp = quizState.followUpQuestions[quizState.currentFollowUpIndex];
    const chatContainer = document.getElementById('chat-container');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message message-system';
    messageDiv.innerHTML = `
        <div class="message-bubble" style="background: #ede9fe; border-left: 4px solid #6366f1;">
            <strong>Follow-up ${quizState.currentFollowUpIndex + 1} of ${quizState.followUpQuestions.length}</strong>
            <p style="margin-top: 8px;">${followUp.question}</p>
            ${followUp.guidance ? `<p style="margin-top: 8px; font-size: 13px; opacity: 0.8;">💡 Hint: ${followUp.guidance}</p>` : ''}
        </div>
    `;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Show input
    document.getElementById('blooms-answer').value = '';
    document.getElementById('answer-input-container').style.display = 'block';
    
    // Change submit button behavior for follow-ups
    const submitBtn = document.getElementById('submit-answer-btn');
    submitBtn.onclick = submitFollowUpAnswer;
}

// ===========================================
// BLOOM'S - SUBMIT FOLLOW-UP ANSWER
// ===========================================
async function submitFollowUpAnswer() {
    const answerText = document.getElementById('blooms-answer').value.trim();
    
    if (!answerText) {
        alert('Please provide an answer.');
        return;
    }
    
    const chatContainer = document.getElementById('chat-container');
    
    // Add answer to chat
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'chat-message message-user';
    userMessageDiv.innerHTML = `
        <div class="message-bubble">
            <p>${answerText}</p>
        </div>
    `;
    chatContainer.appendChild(userMessageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Simple acknowledgment
    const ackDiv = document.createElement('div');
    ackDiv.className = 'chat-message message-system';
    ackDiv.innerHTML = `
        <div class="message-bubble" style="background: #f0fdf4;">
            <p>Good! ${quizState.currentFollowUpIndex < quizState.followUpQuestions.length - 1 ? "Let's try another one." : "You've completed the follow-ups!"}</p>
        </div>
    `;
    chatContainer.appendChild(ackDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    quizState.currentFollowUpIndex++;
    
    if (quizState.currentFollowUpIndex < quizState.followUpQuestions.length) {
        // Show next follow-up
        setTimeout(() => displayFollowUpQuestion(), 500);
    } else {
        // Done with follow-ups
        quizState.isInFollowUp = false;
        document.getElementById('answer-input-container').style.display = 'none';
        document.getElementById('action-buttons').style.display = 'flex';
        document.getElementById('request-followup-btn').style.display = 'none';
    }
}

// ===========================================
// BLOOM'S - NEXT QUESTION
// ===========================================
function nextBloomsQuestion() {
    quizState.currentQuestionIndex++;
    
    if (quizState.currentQuestionIndex >= quizState.questions.length) {
        // Quiz complete
        document.getElementById('answer-input-container').style.display = 'none';
        document.getElementById('action-buttons').style.display = 'none';
        document.getElementById('quiz-complete').style.display = 'block';
    } else {
        // Show next question
        document.getElementById('request-followup-btn').style.display = 'block';
        const submitBtn = document.getElementById('submit-answer-btn');
        submitBtn.onclick = submitBloomsAnswer;
        displayQuestion();
    }
}

// ===========================================
// BLOOM'S - SKIP QUESTION
// ===========================================
function skipBloomsQuestion() {
    const chatContainer = document.getElementById('chat-container');
    
    const skipDiv = document.createElement('div');
    skipDiv.className = 'chat-message message-system';
    skipDiv.innerHTML = `
        <div class="message-bubble" style="background: #fef3c7;">
            <p>Question skipped. Moving to the next one...</p>
        </div>
    `;
    chatContainer.appendChild(skipDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    setTimeout(() => nextBloomsQuestion(), 500);
}

// ===========================================
// BLOOM'S - RESET QUIZ
// ===========================================
function resetBloomsQuiz() {
    quizState = {
        questions: [],
        currentQuestionIndex: 0,
        userAnswers: [],
        isInFollowUp: false,
        followUpQuestions: [],
        currentFollowUpIndex: 0,
        lectureContent: ''
    };
    
    document.getElementById('blooms-setup').style.display = 'block';
    document.getElementById('blooms-quiz').style.display = 'none';
    document.getElementById('chat-container').innerHTML = '';
    document.getElementById('quiz-complete').style.display = 'none';
    document.getElementById('generate-quiz-btn').disabled = false;
    document.getElementById('generate-quiz-btn').textContent = 'Generate Quiz';
}


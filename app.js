// OpenAI API Configuration
const OPENAI_API_KEY = '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';
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
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';
    
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
4. Score them based on depth and accuracy of what they DID explain, not breadth of coverage`;
        
        const userPrompt = `Compare the student's explanation to the reference material and provide a detailed assessment.

REFERENCE MATERIAL:
${referenceText}

STUDENT'S EXPLANATION:
${blurtText}

ASSESSMENT GUIDELINES:
- First identify which specific topic or section from the reference material the student is addressing
- Score them ONLY on their understanding of that specific topic (0-100)
- Do NOT deduct points for not covering other topics in the reference material
- Focus on: accuracy, depth of understanding, correct use of terminology, logical flow
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

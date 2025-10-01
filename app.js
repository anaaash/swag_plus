document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Element References ---
    const apiTokenInput = document.getElementById('apiToken');
    const selectReviewBtn = document.getElementById('selectReviewBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const countNounsBtn = document.getElementById('countNounsBtn');
    
    const reviewDisplay = document.getElementById('reviewDisplay');
    const reviewTextElement = document.getElementById('reviewText');
    const actionButtons = document.getElementById('actionButtons');
    
    const sentimentResultArea = document.getElementById('sentimentResultArea');
    const sentimentIconElement = document.getElementById('sentimentIcon');
    const sentimentDetailsElement = document.getElementById('sentimentDetails');
    
    const nounResultArea = document.getElementById('nounResultArea');
    const nounCountDetailsElement = document.getElementById('nounCountDetails');

    const errorElement = document.getElementById('error');
    const loadingElement = document.getElementById('loading');
    
    // --- State Variables ---
    let reviews = [];
    let currentReview = '';

    // --- Initialization ---
    // Load and parse the TSV file on page load
    fetch('reviews_test.tsv')
        .then(response => {
            if (!response.ok) throw new Error(`Could not load reviews file: ${response.statusText}`);
            return response.text();
        })
        .then(tsvData => {
            const parsedData = Papa.parse(tsvData, { header: true, delimiter: '\t', skipEmptyLines: true });
            
            if (parsedData.errors && parsedData.errors.length > 0) {
                throw new Error('Error parsing TSV file: ' + parsedData.errors[0].message);
            }
            
            reviews = parsedData.data
                .filter(row => row.text && row.text.trim() !== '')
                .map(row => row.text.trim());
                
            if (reviews.length === 0) {
                throw new Error('No valid reviews found in the TSV file');
            }
            
            selectReviewBtn.disabled = false;
            selectReviewBtn.textContent = 'Select Random Review';
        })
        .catch(error => {
            showError(error.message);
            selectReviewBtn.textContent = 'Failed to Load Reviews';
        });
    
    // --- Event Listeners ---
    selectReviewBtn.addEventListener('click', displayRandomReview);
    analyzeBtn.addEventListener('click', handleSentimentAnalysis);
    countNounsBtn.addEventListener('click', handleNounCount);

    // --- Core Functions ---
    function displayRandomReview() {
        if (reviews.length === 0) {
            showError('No reviews available for analysis');
            return;
        }
        
        hideError();
        sentimentResultArea.style.display = 'none';
        nounResultArea.style.display = 'none';

        const randomIndex = Math.floor(Math.random() * reviews.length);
        currentReview = reviews[randomIndex];
        reviewTextElement.textContent = currentReview;
        
        reviewDisplay.style.display = 'block';
        actionButtons.style.display = 'block';
    }

    async function handleSentimentAnalysis() {
        if (!currentReview) return;
        
        setLoadingState(true);
        const model = 'siebert/sentiment-roberta-large-english';
        
        try {
            const data = await callApi(model, currentReview);
            if (!data || !Array.isArray(data) || !data[0] || !Array.isArray(data[0])) {
                throw new Error('Invalid response format from Sentiment API.');
            }
            displaySentiment(data[0][0]);
        } catch (error) {
            showError(error.message);
        } finally {
            setLoadingState(false);
        }
    }

    async function handleNounCount() {
        if (!currentReview) return;

        setLoadingState(true);
        const model = 'vblagoje/bert-english-uncased-finetuned-pos';

        try {
            const data = await callApi(model, currentReview);
            if (!data || !Array.isArray(data)) {
                throw new Error('Invalid response format from POS Tagging API.');
            }
            displayNounCount(data);
        } catch (error) {
            showError(error.message);
        } finally {
            setLoadingState(false);
        }
    }

    // --- API Call Logic ---
    async function callApi(model, text) {
        const apiToken = apiTokenInput.value.trim();
        const headers = { 'Content-Type': 'application/json' };
        if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`;
        }

        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: text, options: { wait_for_model: true } })
        });
        
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: "Unknown API error" }));
            throw new Error(`API Error (${response.status}): ${errorBody.error || response.statusText}`);
        }
        
        return response.json();
    }

    // --- UI Update Functions ---
    function displaySentiment(result) {
        let sentiment, iconClass, color;
        
        if (result.label === 'POSITIVE') {
            sentiment = 'Positive'; iconClass = 'fa-thumbs-up'; color = '#2f855a';
        } else {
            sentiment = 'Negative'; iconClass = 'fa-thumbs-down'; color = '#c53030';
        }
        
        sentimentIconElement.innerHTML = `<i class="fas ${iconClass}" style="color: ${color};"></i>`;
        sentimentDetailsElement.innerHTML = `<strong>${sentiment}</strong> with ${(result.score * 100).toFixed(1)}% confidence.`;
        
        sentimentResultArea.style.display = 'block';
        nounResultArea.style.display = 'none'; // Hide other result
    }

    function displayNounCount(posResults) {
        const nouns = posResults.filter(token => token.entity_group === 'NOUN');
        nounCountDetailsElement.textContent = `Found ${nouns.length} noun(s) in the review.`;
        
        nounResultArea.style.display = 'block';
        sentimentResultArea.style.display = 'none'; // Hide other result
    }

    function setLoadingState(isLoading) {
        loadingElement.style.display = isLoading ? 'block' : 'none';
        selectReviewBtn.disabled = isLoading;
        analyzeBtn.disabled = isLoading;
        countNounsBtn.disabled = isLoading;
        if (isLoading) {
            hideError();
            sentimentResultArea.style.display = 'none';
            nounResultArea.style.display = 'none';
        }
    }
    
    function showError(message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    function hideError() {
        errorElement.style.display = 'none';
        errorElement.textContent = '';
    }
});

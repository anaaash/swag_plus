document.addEventListener('DOMContentLoaded', function() {
    const selectReviewBtn = document.getElementById('selectReviewBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const countNounsBtn = document.getElementById('countNounsBtn');
    const apiTokenInput = document.getElementById('apiToken');
    const reviewTextElement = document.getElementById('reviewText');
    const sentimentIconElement = document.getElementById('sentimentIcon');
    const sentimentDetailsElement = document.getElementById('sentimentDetails');
    const resultElement = document.getElementById('result');
    const errorElement = document.getElementById('error');
    const loadingElement = document.getElementById('loading');
    const actionButtons = document.getElementById('actionButtons');
    const nounResultElement = document.getElementById('nounResult');
    const sentimentSection = document.getElementById('sentimentSection');

    let reviews = [];
    let currentReview = "";

    // Load and parse the TSV file
    fetch('reviews_test.tsv')
        .then(response => response.text())
        .then(tsvData => {
            const parsedData = Papa.parse(tsvData, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true
            });
            
            if (parsedData.errors && parsedData.errors.length > 0) {
                showError('Error parsing TSV file: ' + parsedData.errors[0].message);
                return;
            }
            
            reviews = parsedData.data
                .filter(row => row.text && row.text.trim() !== '')
                .map(row => row.text.trim());
                
            if (reviews.length === 0) {
                showError('No reviews found in the TSV file');
                return;
            }
            
            selectReviewBtn.disabled = false;
        })
        .catch(error => {
            showError('Error loading TSV file: ' + error.message);
        });

    // Select random review
    selectReviewBtn.addEventListener('click', function() {
        if (reviews.length === 0) {
            showError('No reviews available for analysis');
            return;
        }
        
        hideError();
        sentimentSection.style.display = 'none';
        nounResultElement.style.display = 'none';
        resultElement.style.display = 'block';

        const randomIndex = Math.floor(Math.random() * reviews.length);
        currentReview = reviews[randomIndex];
        reviewTextElement.textContent = currentReview;

        actionButtons.style.display = 'block';
    });

    // Analyze sentiment
    analyzeBtn.addEventListener('click', function() {
        if (!currentReview) {
            showError('No review selected');
            return;
        }
        
        processRequest('sentiment');
    });

    // Count nouns
    countNounsBtn.addEventListener('click', function() {
        if (!currentReview) {
            showError('No review selected');
            return;
        }
        
        processRequest('nouns');
    });

    function processRequest(type) {
        hideError();
        loadingElement.style.display = 'block';
        disableAllButtons(true);

        const apiToken = apiTokenInput.value.trim();
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`;
        }

        let url;
        if (type === 'sentiment') {
            url = 'https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english';
        } else if (type === 'nouns') {
            url = 'https://api-inference.huggingface.co/models/vblagoje/bert-english-uncased-finetuned-pos';
        }

        fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: currentReview })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error('Model is loading, please try again in a few moments');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later or add your API token.');
                } else {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
            }
            return response.json();
        })
        .then(data => {
            loadingElement.style.display = 'none';
            disableAllButtons(false);

            if (type === 'sentiment') {
                if (!data || !Array.isArray(data) || data.length === 0) {
                    throw new Error('Invalid sentiment response from API');
                }
                const result = data[0][0];
                displaySentiment(result);
            } else if (type === 'nouns') {
                if (!data || !Array.isArray(data) || data.length === 0) {
                    throw new Error('Invalid POS tagging response from API');
                }
                displayNounCount(data[0]);
            }
        })
        .catch(error => {
            loadingElement.style.display = 'none';
            disableAllButtons(false);
            showError(error.message);
        });
    }

    function displaySentiment(result) {
        let sentiment, iconClass, color;
        
        if (result.label === 'POSITIVE' && result.score > 0.5) {
            sentiment = 'Positive';
            iconClass = 'fa-thumbs-up';
            color = 'green';
        } else if (result.label === 'NEGATIVE' && result.score > 0.5) {
            sentiment = 'Negative';
            iconClass = 'fa-thumbs-down';
            color = 'red';
        } else {
            sentiment = 'Neutral';
            iconClass = 'fa-question-circle';
            color = 'gray';
        }
        
        sentimentIconElement.innerHTML = `<i class="fas ${iconClass}" style="color: ${color};"></i>`;
        sentimentDetailsElement.innerHTML = `
            <p>Sentiment: <strong>${sentiment}</strong></p>
            <p>Label: ${result.label}</p>
            <p>Confidence: ${(result.score * 100).toFixed(2)}%</p>
        `;
        
        sentimentSection.style.display = 'block';
    }

    function displayNounCount(posResults) {
        const nouns = posResults.filter(token => token.entity_group === 'NOUN');
        nounResultElement.textContent = `Noun Count: ${nouns.length}`;
        nounResultElement.style.display = 'block';
    }

    function disableAllButtons(disable) {
        selectReviewBtn.disabled = disable;
        analyzeBtn.disabled = disable;
        countNounsBtn.disabled = disable;
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

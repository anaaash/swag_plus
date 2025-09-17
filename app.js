document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const apiTokenInput = document.getElementById('apiToken');
    const reviewTextElement = document.getElementById('reviewText');
    const sentimentIconElement = document.getElementById('sentimentIcon');
    const sentimentDetailsElement = document.getElementById('sentimentDetails');
    const resultElement = document.getElementById('result');
    const errorElement = document.getElementById('error');
    const loadingElement = document.getElementById('loading');
    
    let reviews = [];
    
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
            
            analyzeBtn.disabled = false;
        })
        .catch(error => {
            showError('Error loading TSV file: ' + error.message);
        });
    
    analyzeBtn.addEventListener('click', function() {
        if (reviews.length === 0) {
            showError('No reviews available for analysis');
            return;
        }
        
        // Reset UI
        hideError();
        resultElement.style.display = 'none';
        loadingElement.style.display = 'block';
        analyzeBtn.disabled = true;
        
        // Select a random review
        const randomIndex = Math.floor(Math.random() * reviews.length);
        const randomReview = reviews[randomIndex];
        
        // Display the review
        reviewTextElement.textContent = randomReview;
        
        // Prepare API request
        const apiToken = apiTokenInput.value.trim();
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`;
        }
        
        // Call Hugging Face API
        fetch('https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: randomReview })
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
            analyzeBtn.disabled = false;
            
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('Invalid response from API');
            }
            
            const result = data[0][0];
            displaySentiment(result);
        })
        .catch(error => {
            loadingElement.style.display = 'none';
            analyzeBtn.disabled = false;
            showError(error.message);
        });
    });
    
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
        
        resultElement.style.display = 'block';
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

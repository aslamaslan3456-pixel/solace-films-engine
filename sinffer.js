const puppeteer = require('puppeteer');
const fs = require('fs');

// Comprehensive array of active multi-provider streaming endpoints
const PROVIDERS = [
    { 
        name: 'Vidfast', 
        getMovieUrl: (tmdb) => `https://vidfast.vc/embed/movie/${tmdb}`,
        getTvUrl: (tmdb, season, episode) => `https://vidfast.vc/embed/tv/${tmdb}/${season}/${episode}`
    },
    { 
        name: 'Vidlink', 
        getMovieUrl: (tmdb) => `https://vidlink.pro/movie/${tmdb}`,
        getTvUrl: (tmdb, season, episode) => `https://vidlink.pro/tv/${tmdb}/${season}/${episode}`
    },
    { 
        name: 'Cinesrc', 
        getMovieUrl: (tmdb) => `https://cinesrc.st/embed/movie/${tmdb}`,
        getTvUrl: (tmdb, season, episode) => `https://cinesrc.st/embed/tv/${tmdb}/${season}/${episode}`
    },
    { 
        name: 'VidsrcSBS', 
        getMovieUrl: (tmdb) => `https://vidsrc.sbs/embed/movie/${tmdb}`,
        getTvUrl: (tmdb, season, episode) => `https://vidsrc.sbs/embed/tv/${tmdb}/${season}/${episode}`
    },
    { 
        name: 'Vidzee', 
        getMovieUrl: (tmdb) => `https://player.vidzee.wtf/embed/movie/${tmdb}`,
        getTvUrl: (tmdb, season, episode) => `https://player.vidzee.wtf/embed/tv/${tmdb}/${season}/${episode}`
    },
    { 
        name: 'Videasy', 
        getMovieUrl: (tmdb) => `https://videasy.net/embed/movie/${tmdb}`,
        getTvUrl: (tmdb, season, episode) => `https://videasy.net/embed/tv/${tmdb}/${season}/${episode}`
    },
    { 
        name: 'VidsrcTO', 
        getMovieUrl: (tmdb) => `https://vidsrc.to/embed/movie/${tmdb}`,
        getTvUrl: (tmdb, season, episode) => `https://vidsrc.to/embed/tv/${tmdb}/${season}/${episode}`
    }
];

async function scrapeStream({ type, tmdbId, season = 1, episode = 1 }) {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let finalStreamUrl = null;
    const page = await browser.newPage();

    // Intercept network traffic across the page to extract raw .m3u8 files
    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('.m3u8') && !finalStreamUrl) {
            finalStreamUrl = url;
            console.log(`🎯 [CAUGHT STREAM]: ${url}`);
        }
    });

    // Loop through providers one by one until a stream link is captured
    for (const provider of PROVIDERS) {
        const embedUrl = type === 'tv' 
            ? provider.getTvUrl(tmdbId, season, episode) 
            : provider.getMovieUrl(tmdbId);

        console.log(`Trying ${provider.name} for ${type}: ${embedUrl}`);

        try {
            await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for media handshake

            if (finalStreamUrl) {
                console.log(`Success via ${provider.name}!`);
                break;
            }
        } catch (err) {
            console.log(`${provider.name} timed out or failed, switching fallback...`);
        }
    }

    await browser.close();
    return finalStreamUrl;
}

(async () => {
    // Media target definition (Change type to 'tv' and supply season/episode for series)
    const mediaJob = { type: 'movie', tmdbId: 969681, season: 1, episode: 1 };
    
    const streamUrl = await scrapeStream(mediaJob);

    if (streamUrl) {
        let db = fs.existsSync('movies-db.json') ? JSON.parse(fs.readFileSync('movies-db.json', 'utf8')) : [];
        
        const uniqueKey = mediaJob.type === 'tv' 
            ? `${mediaJob.tmdbId}_S${mediaJob.season}E${mediaJob.episode}` 
            : `${mediaJob.tmdbId}`;

        const existing = db.find(m => m.key === uniqueKey);
        if (existing) {
            existing.stream_url = streamUrl;
            existing.updated_at = new Date().toISOString();
        } else {
            db.push({ 
                key: uniqueKey, 
                id: mediaJob.tmdbId, 
                type: mediaJob.type,
                season: mediaJob.season,
                episode: mediaJob.episode,
                stream_url: streamUrl, 
                updated_at: new Date().toISOString() 
            });
        }

        fs.writeFileSync('movies-db.json', JSON.stringify(db, null, 2));
        console.log("movies-db.json updated successfully with multi-provider failovers.");
    }
})();

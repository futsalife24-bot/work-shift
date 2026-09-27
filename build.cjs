const fs=require('fs');
const html=fs.readFileSync('src/index.html','utf8'),js=fs.readFileSync('src/app.js','utf8');
if(js.includes('</script>'))throw Error('inline script terminator');
const merged=html.replace('<script src="app.js"></script>',()=>'<script>\n'+js+'\n</script>');
fs.writeFileSync('勤務表ツール.html',merged);
fs.writeFileSync('index.html',merged.replace('</head>','<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#2563eb"><link rel="icon" href="icon-192-v2.png"><link rel="apple-touch-icon" href="icon-192-v2.png"></head>').replace('</body>','<script>if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</script></body>'));

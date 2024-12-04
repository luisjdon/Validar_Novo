const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Configuração do multer para upload de arquivos
const upload = multer({ dest: 'uploads/' });

// Middleware para servir arquivos estáticos, como a página HTML
app.use(express.static('public'));

// Rota para renderizar a página de upload
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para gerar e exibir o QR code para vincular o dispositivo
app.get('/vincular', async (req, res) => {
    try {
        // Solicita a geração do QR code para vincular o dispositivo
        const response = await axios.get(`https://gateway.apibrasil.io/api/v2/qr-code/${process.env.DEVICE_TOKEN}`, {
            headers: {
                'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
            }
        });

        // Responde com o QR code gerado (pode ser exibido como imagem na página)
        const qrCodeImage = response.data.qr_code; // Certifique-se de que a resposta contém a imagem do QR code

        res.send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Vincule seu Dispositivo</title>
            </head>
            <body>
                <h1>Vincule seu dispositivo ao WhatsApp</h1>
                <p>Escaneie o QR code abaixo para vincular seu dispositivo:</p>
                <img src="data:image/png;base64,${qrCodeImage}" alt="QR Code">
                <p>Após escanear, você poderá usar a funcionalidade de verificação de números.</p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Erro ao gerar QR code:', error);
        res.status(500).send('Erro ao gerar QR code');
    }
});

// Rota para fazer upload e processar a lista
app.post('/upload', async (req, res) => {
    try {
        // Verifique se o dispositivo está vinculado
        const response = await axios.get('https://gateway.apibrasil.io/api/v2/device/status', {
            headers: {
                'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
            }
        });

        if (response.data.status !== 'linked') {
            return res.status(400).send('Dispositivo não vinculado. Por favor, vincule o dispositivo acessando /vincular');
        }

        // Continua com o processo de upload
        const file = req.file;
        if (!file) {
            return res.status(400).send('Nenhum arquivo enviado');
        }

        const filePath = path.join(__dirname, 'uploads', file.filename);
        const phoneNumbers = fs.readFileSync(filePath, 'utf-8').split('\n');
        const activeNumbers = [];

        for (const number of phoneNumbers) {
            if (number.trim() === '') continue;

            // Verifique se o número tem WhatsApp ativo
            const phoneResponse = await axios.get(`https://gateway.apibrasil.io/api/v2/whatsapp/check?number=${number}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.BEARER_TOKEN}`
                }
            });

            if (phoneResponse.data.active) {
                activeNumbers.push(number);
            }
        }

        // Salva a lista de números ativos em um arquivo de saída
        const outputFilePath = path.join(__dirname, 'uploads', 'output.txt');
        fs.writeFileSync(outputFilePath, activeNumbers.join('\n'));

        res.download(outputFilePath, 'output.txt');
    } catch (error) {
        console.error('Erro ao processar os números:', error);
        res.status(500).send('Erro ao processar os números');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

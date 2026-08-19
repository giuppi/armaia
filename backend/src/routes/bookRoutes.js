const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const upload = require('../middleware/upload');
const mockAuth = require('../middleware/mockAuth');

// Ricerca geospaziale e testuale pubblica
router.get('/nearby', bookController.getNearbyBooks);
router.get('/area', bookController.getBooksInArea);
router.get('/search', bookController.searchBooks);

// Catalogo utente
router.get('/user/:username', bookController.getUserBooks);

// Operazioni protette con autenticazione stub
router.post('/', mockAuth, upload.single('cover'), bookController.createBook);
router.put('/:id', mockAuth, upload.single('cover'), bookController.updateBook);
router.delete('/:id', mockAuth, bookController.deleteBook);

module.exports = router;

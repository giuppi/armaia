const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const mockAuth = require('../middleware/mockAuth');

// Tutte le operazioni di prestito richiedono identità utente verificata
router.post('/', mockAuth, loanController.requestLoan);
router.get('/', mockAuth, loanController.getUserLoans);
router.put('/:loanId/status', mockAuth, loanController.updateLoanStatus);

module.exports = router;

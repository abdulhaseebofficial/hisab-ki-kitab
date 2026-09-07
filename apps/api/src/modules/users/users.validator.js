const { body } = require('express-validator');
const { MODES, LANGUAGES } = require('@hisabkikitab/contracts/catalogue');
const { name, password, CURRENCY_CODES } = require('../../shared/validation/rules');

const profileValidators = {
  update: [
    name().optional(),
    body('monthlyIncome').optional().isFloat({ min: 0 }).withMessage('Income cannot be negative').toFloat(),
    body('currency').optional().isIn(CURRENCY_CODES).withMessage('Unsupported currency'),
    body('university').optional().trim().isLength({ max: 100 }),
    body('hostelName').optional().trim().isLength({ max: 100 }),
    body('theme').optional().isIn(['light', 'dark', 'system']),
    // Strict allowlists, from the catalogue rather than a second copy here.
    // A locale or a mode is never taken on the client's word.
    body('financeMode').optional().isIn(MODES).withMessage('Unsupported finance mode'),
    body('language').optional().isIn(LANGUAGES).withMessage('Unsupported language'),
  ],

  onboarding: [
    body('monthlyIncome').isFloat({ min: 0 }).withMessage('Enter your monthly pocket money').toFloat(),
    body('financeMode').optional().isIn(MODES).withMessage('Unsupported finance mode'),
    body('language').optional().isIn(LANGUAGES).withMessage('Unsupported language'),
    body('currency').optional().isIn(CURRENCY_CODES),
    body('goal.title').optional().trim().isLength({ max: 80 }),
    body('goal.targetAmount').optional().isFloat({ gt: 0 }).toFloat(),
  ],

  addCategory: [body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 40 })],

  deleteAccount: [body('password').notEmpty().withMessage('Password is required to delete your account')],
};

/* ------------------------------ expenses ----------------------------- */

module.exports = profileValidators;

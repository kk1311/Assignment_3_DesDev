const express = require('express');
const path = require('path');
const { body, validationResult } = require('express-validator');
const products = require('./productData'); // Import product data module
const ejs = require('ejs');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

const provinceTaxRates = {
    'ON': 0.13, // Ontario
    'QC': 0.14975, // Quebec
    'BC': 0.12 // British Columbia
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.post('/order',
    body('name').notEmpty().withMessage('Name is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('province').notEmpty().withMessage('Province is required'),
    body('phone').matches(/^[0-9]{10}$/).withMessage('Phone number must be 10 digits'),
    body('products').isArray({ min: 1 }).withMessage('At least one product must be selected'),

    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const productsSelected = req.body.products || [];
        const quantities = req.body.quantities || [];
        const totalAmount = calculateTotalAmount(productsSelected, quantities);

        const province = req.body.province.toUpperCase();
        const taxRate = provinceTaxRates[province] || 0;
        const salesTax = totalAmount * taxRate;
        const totalWithTax = totalAmount + salesTax;

        if (totalWithTax < 10) {
            return res.status(400).send('Minimum purchase should be $10 or more.');
        }

        // Generate receipt here
        const receiptHTML = generateReceipt(req.body, productsSelected, quantities, totalAmount, salesTax, totalWithTax);

        // Send the rendered HTML as the response
        res.send(receiptHTML);
    }
);

function calculateTotalAmount(products, quantities) {
    let total = 0;
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const quantity = parseInt(quantities[i]);
        const price = getProductPrice(product);
        total += price * quantity;
    }
    return total;
}

function getProductPrice(productName) {
    const product = products.find(p => p.name === productName);
    return product ? product.price : 0;
}

function generateReceipt(formData, productsSelected, quantities, totalAmount, salesTax, totalWithTax) {
    const province = formData.province.toUpperCase();
    const taxRate = provinceTaxRates[province] || 0;

    let productsList = ''; // Initialize empty products list
    let subtotal = 0; // Initialize subtotal

    // Generate receipt HTML for each selected product
    for (let i = 0; i < productsSelected.length; i++) {
        const productName = productsSelected[i];
        const quantity = parseInt(quantities[i]);

        if (quantity > 0) { // Only include products with selected quantity
            const price = getProductPrice(productName);
            const totalPrice = price * quantity;
            productsList += `
                <tr>
                    <td>${productName}</td>
                    <td>${quantity}</td>
                    <td>$${totalPrice.toFixed(2)}</td>
                </tr>
            `;
            subtotal += totalPrice; // Accumulate subtotal
        }
    }

    const calculatedSalesTax = totalAmount * taxRate; // Calculate sales tax based on total amount and tax rate

    // Render the EJS template with data
    return ejs.renderFile(path.join(__dirname, 'views', 'receipt.ejs'), {
        productsList: productsList,
        subtotal: subtotal,
        province: province,
        taxRate: taxRate,
        calculatedSalesTax: calculatedSalesTax,
        totalWithTax: totalWithTax
    });
}
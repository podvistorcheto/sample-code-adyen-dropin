const express = require("express");
const path = require("path");
const {
    engine
} = require('express-handlebars')
const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const {
    Client,
    Config,
    CheckoutAPI
} = require("@adyen/api-library");
const app = express();

app.use(express.urlencoded({
    extended: false
}));
app.use(express.static(path.join(__dirname, "/public")));
app.use(cookieParser());

// Set up the dotenv config
dotenv.config({
    path: "./.env"
});

// Adyen Node.js API library boilerplate (configuration, etc.)
const config = new Config();
config.apiKey = process.env.API_KEY;
config.merchantAccount = process.env.MERCHANT_ACCOUNT;
const client = new Client({
    config
});
client.setEnvironment("TEST");
const checkout = new CheckoutAPI(client);

// handlebar middleware
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set("views", "./views");

// Index (select a demo)
app.get("/", (req, res) => res.render("index"));

// Cart (continue to checkout)
app.get("/preview", (req, res) =>
    res.render("preview", {
        type: req.query.type
    })
);

function findCurrency(type) {
    switch (type) {
        case "ideal":
        case "giropay":
        case "klarna_paynow":
        case "sepadirectdebit":
        case "directEbanking":
            return "EUR";
            break;
        case "wechatpayqr":
        case "alipay":
            return "CNY";
            break;
        case "dotpay":
            return "PLN";
            break;
        case "boletobancario":
            return "BRL";
            break;
        default:
            return "EUR";
            break;
    }
}

// list with payment methods
app.get("getPaymentMethods", (req, res) => {
    let currency = findCurrency(req.params.type);
    checkout
        .paymentMethods({
            amount: {
                currency,
                value: 1000
            },
            channel: "Web",
            merchantAccount: config.merchantAccount
        })
        .then(response => {
            res.json(response);
        });
});

// Checkout page (make a payment)
app.get("/checkout/:type", (req, res) => {
    let currency = findCurrency(req.params.type);
    checkout.paymentMethods({
            amount: {
                currency,
                value: 1000
            },
            channel: "Web",
            merchantAccount: config.merchantAccount
        })
        .then(response => {
            res.render("payment", {
                type: req.params.type,
                originKey: process.env.ORIGIN_KEY,
                response: JSON.stringify(response)
            });
        });
});

// Submitting a payment
app.post("/initiatePayment", jsonParser, (req, res) => {
    let currency = findCurrency(req.params.type);
    checkout
        .payments({
            amount: {
                currency,
                value: 1000
            },
            paymentMethod: req.body.paymentMethod,
            reference: "12345",
            merchantAccount: config.merchantAccount,
            shopperIP: "192.168.1.3",
            channel: "Web",
            browserInfo: req.body.browserInfo,
            additionalData: {
                allow3DS2: true
            },
            returnUrl: "http://localhost:8080/confirmation"
        })
        .then(response => {
            let paymentMethodType = req.body.paymentMethod.type;
            let resultCode = response.resultCode;
            let redirectUrl =
                response.redirect !== undefined ? response.redirect.url : null;
            let action = null;

            if (response.action) {
                action = response.action;
                res.cookie("paymentData", action.paymentData);
            }

            res.json({
                paymentMethodType,
                resultCode,
                redirectUrl,
                action
            });
        });
});

// Confirmation page
app.get("/confirmation", (req, res) => res.render("confirmation"));

// After completing the 3DS2 authentication, the shopper is redirected
// back to returnUrl via an HTTP POST, appended with MD and PaRes variables
app.post("/confirmation", (req, res) => {
    // Create the payload for submitting payment details
    let payload = {};
    payload["details"] = req.body;
    payload["paymentData"] = req.cookies["paymentData"];

    checkout.paymentsDetails(payload).then(response => {
        res.clearCookie("paymentData");
        // Conditionally handle different result codes for the shopper
        // (a generic error page is used in this demo for simplicity)
        response.resultCode === "Authorised" ?
            res.redirect("/confirmation") :
            res.redirect("/error");
    });
});

app.post("/submitAdditionalDetails", (req, res) => {
    // Create the payload for submitting payment details
    let payload = {};
    payload["details"] = req.body.details;
    payload["paymentData"] = req.body.paymentData;

    // Return the response back to client
    // (for further action handling or presenting result to shopper)
    checkout.paymentsDetails(payload).then(response => {
        let resultCode = response.resultCode;
        let action = response.action || null;

        res.json({
            action,
            resultCode
        });
    });
});

// payment completed
app.get("/success", (req, res) => res.render("success"));

// error page
app.get("/error", (req, res) => res.render("error"));

// payment failed
app.get("/failed", (req, res) => res.render("failed"));

const port = process.env.PORT || 8080;


app.listen(port, function () {
    console.log(`Server is listening on port ${port}....`)
})
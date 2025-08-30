import SSLCommerzPayment from "sslcommerz-lts";

const store_id = process.env.SSLCZ_STORE_ID || "sellp68acc6dd78089";
const store_passwd = process.env.SSLCZ_STORE_PASSWD || "sellp68acc6dd78089@ssl";
const sandbox = String(process.env.SSLCZ_SANDBOX).toLowerCase() === "true";
// sslcommerz-lts expects: third param = is_live
const is_live = !sandbox;

export const initiatePayment = async ({
    amount,
    tranId,
    success_url,
    fail_url,
    cancel_url,
    ipn_url,
    cus_email,
    cus_phone,
    cus_name,
}) => {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

    const data = {
        total_amount: Number(amount).toFixed(2),
        currency: "BDT",
        tran_id: tranId,
        success_url,
        fail_url,
        cancel_url,
        ipn_url,

        // Customer
        cus_name: cus_name || "Customer",
        cus_email: cus_email || "no-reply@sellpoint.local",
        cus_add1: "Dhaka",
        cus_city: "Dhaka",
        cus_country: "Bangladesh",
        cus_phone: cus_phone || "01700000000",

        // Product
        product_name: "SellPoint Plan Purchase",
        product_category: "Digital",
        product_profile: "general",

        // Misc
        shipping_method: "NO",
    };

    return sslcz.init(data); // { status, sessionkey, GatewayPageURL, ... }
};

export const validateIPN = (body = {}) =>
    !!body?.tran_id &&
    (body?.status === "VALID" || body?.status === "VALIDATED" || body?.status === "SUCCESS");

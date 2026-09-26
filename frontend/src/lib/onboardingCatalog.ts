export type ConnectorDef = {
  id: string;
  name: string;
  category: "sales" | "accounting" | "suppliers" | "messages";
  blurb: string;
  oauthStyle: boolean;
  help: string[];
};

export const CONNECTORS: ConnectorDef[] = [
  {
    id: "shopify",
    name: "Shopify",
    category: "sales",
    blurb: "Sync products and orders from your Shopify store.",
    oauthStyle: true,
    help: [
      "In Shopify, open Settings → Apps and sales channels → Develop apps.",
      "Create an app and allow products and orders access.",
      "Copy the Admin API access token and paste it here.",
    ],
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    category: "sales",
    blurb: "Pull stock and sales from your WooCommerce site.",
    oauthStyle: false,
    help: [
      "In WordPress, open WooCommerce → Settings → Advanced → REST API.",
      "Add a key with Read/Write access.",
      "Copy the Consumer Key and paste it here.",
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    category: "sales",
    blurb: "Bring Amazon marketplace orders into KPM.",
    oauthStyle: true,
    help: [
      "Open Seller Central → Apps & Services → Develop Apps.",
      "Create a private developer profile if needed.",
      "Copy the refresh token or LWA client secret and paste it here.",
    ],
  },
  {
    id: "pos",
    name: "POS",
    category: "sales",
    blurb: "Connect an in-store point of sale feed.",
    oauthStyle: false,
    help: [
      "Open your POS admin and look for Integrations or API.",
      "Create a read-only API key for sales and inventory.",
      "Copy that key and paste it here.",
    ],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "accounting",
    blurb: "Match KPM sales with QuickBooks accounts.",
    oauthStyle: true,
    help: [
      "In Intuit Developer, create an app for QuickBooks Online.",
      "Copy the Client Secret from Keys & OAuth.",
      "Paste it here until one-click sign-in is available.",
    ],
  },
  {
    id: "xero",
    name: "Xero",
    category: "accounting",
    blurb: "Keep Xero ledgers aligned with KPM.",
    oauthStyle: true,
    help: [
      "In the Xero developer portal, open your app.",
      "Copy the client secret from Configuration.",
      "Paste it here until one-click sign-in is available.",
    ],
  },
  {
    id: "kpm_books",
    name: "KPM books",
    category: "accounting",
    blurb: "Use the accounting already built into KPM.",
    oauthStyle: false,
    help: ["KPM books is ready in the app. No key is required."],
  },
  {
    id: "supplier_csv",
    name: "Spreadsheet upload",
    category: "suppliers",
    blurb: "Import supplier catalogs from a CSV file later.",
    oauthStyle: false,
    help: [
      "Prepare a CSV with SKU, name, cost, and quantity.",
      "You can upload it from Suppliers after setup.",
      "Mark this as connected if you plan to use spreadsheets.",
    ],
  },
  {
    id: "supplier_edi",
    name: "EDI",
    category: "suppliers",
    blurb: "Exchange purchase orders with EDI partners.",
    oauthStyle: false,
    help: [
      "Ask your EDI provider for a mailbox or AS2 credential.",
      "Copy the access key they give you.",
      "Paste that key here.",
    ],
  },
  {
    id: "supplier_api",
    name: "Supplier API",
    category: "suppliers",
    blurb: "Pull stock and pricing from a supplier API.",
    oauthStyle: false,
    help: [
      "Open the supplier’s partner portal.",
      "Create an API key with catalog read access.",
      "Copy and paste the key here.",
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    category: "messages",
    blurb: "Draft replies for WhatsApp Business chats.",
    oauthStyle: true,
    help: [
      "In Meta Business Suite, open WhatsApp accounts.",
      "Create a permanent access token for your phone number.",
      "Paste the token here until one-click sign-in is available.",
    ],
  },
  {
    id: "meta_shop",
    name: "Instagram / Facebook Shop",
    category: "messages",
    blurb: "Link shop messages from Meta.",
    oauthStyle: true,
    help: [
      "In Meta for Developers, open your Commerce app.",
      "Copy a page access token with catalog and messages access.",
      "Paste it here until one-click sign-in is available.",
    ],
  },
  {
    id: "email",
    name: "Email",
    category: "messages",
    blurb: "Draft replies for customer email threads.",
    oauthStyle: false,
    help: [
      "Use an app password from your email provider.",
      "For Gmail, open Google Account → Security → App passwords.",
      "Copy the password and paste it here.",
    ],
  },
];

export const CONNECTOR_GROUPS: Array<{ id: ConnectorDef["category"]; title: string }> = [
  { id: "sales", title: "Sales channels" },
  { id: "accounting", title: "Accounting" },
  { id: "suppliers", title: "Suppliers" },
  { id: "messages", title: "Messages" },
];

export const AUTOMATION_DEFS: Array<{
  id: string;
  name: string;
  blurb: string;
}> = [
  {
    id: "reconcile",
    name: "Reconcile payments",
    blurb: "Match money in and out with your sales and bills.",
  },
  {
    id: "flag_anomalies",
    name: "Flag odd entries",
    blurb: "Point out amounts or stock moves that do not look right.",
  },
  {
    id: "reorder",
    name: "Reorder stock",
    blurb: "Propose a purchase when a product is running low.",
  },
  {
    id: "customer_replies",
    name: "Answer customer questions",
    blurb: "Draft a reply. Automatic stays a draft until you save reply templates later.",
  },
  {
    id: "forecast",
    name: "Forecast demand",
    blurb: "Estimate what you will need next month.",
  },
];

export const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "KES", "GHS"];

export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Nigeria",
  "Kenya",
  "Ghana",
  "Australia",
  "Germany",
  "India",
  "Other",
];

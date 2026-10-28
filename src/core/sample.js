// A fictional web shop: two incidents and the changes around them. Minutes are relative to the moment the
// sample is loaded, so the sample always reads as something that happened in the last few days.
export const SAMPLE_LABEL = 'change-suspects-sample';

export const SAMPLE_INCIDENTS = [
  {
    ref: 'card',
    summary: 'Card payments time out at checkout',
    labels: ['incident', 'payments', 'checkout'],
    startedMin: -12,
    description: 'Customers see a spinner and then "Payment failed" when they pay by card at checkout. Card payments time out after about 30 seconds; PayPal still works.',
  },
  {
    ref: 'images',
    summary: 'Product images load slowly on mobile',
    labels: ['incident', 'cdn', 'mobile'],
    startedMin: -250,
    description: 'Product pages on phones show grey boxes for several seconds before the images appear. Desktop looks normal. The image CDN reports more TLS handshakes than usual.',
  },
];

export const SAMPLE_CHANGES = [
  { summary: 'Lower the card payment gateway timeout to 30 seconds', labels: ['payments'], deployedMin: -47, risk: 'High',
    description: 'Calls to the card payment gateway now give up after 30 seconds instead of 60, so a slow gateway cannot hold checkout workers.' },
  { summary: 'Rename search filters for the autumn catalogue', labels: ['search'], deployedMin: -62,
    description: 'Filter names follow the new catalogue: Knitwear, Outerwear, Boots.' },
  { summary: 'Upgrade the card tokenisation library to 4.2', labels: ['payments'], deployedMin: -202,
    description: 'Security update of the library that turns card numbers into tokens before they reach the gateway.' },
  { summary: 'Rotate the TLS certificate on the image CDN', labels: ['cdn'], deployedMin: -322, risk: 'Medium',
    description: 'The certificate for images.shopfront.example expires next week. New certificate chain from the same issuer.' },
  { summary: 'Increase the checkout page cache lifetime to 10 minutes', labels: ['checkout'], deployedMin: -372,
    description: 'The checkout page shell is cached for 10 minutes instead of 2. Prices and the basket are still loaded live.' },
  { summary: 'Add the PayPal Pay Later button at checkout', labels: ['checkout'], deployedMin: -1572,
    description: 'Shows Pay Later under the PayPal button for baskets over 50 EUR.' },
  { summary: 'Move order confirmation e-mails to the new template', labels: ['email'], deployedMin: -2912,
    description: 'Order confirmations use the new branded template.' },
  { summary: 'Restore the card payment gateway timeout to 60 seconds', labels: ['payments'], deployedMin: -6,
    description: 'Rolls back the timeout change while the card payment incident is investigated.' },
];

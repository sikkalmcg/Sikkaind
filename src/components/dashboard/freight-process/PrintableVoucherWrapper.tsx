'use client';

import PrintableVoucher from './PrintableVoucher';

const PrintableVoucherWrapper = ({ trip }) => {
  return (
    <html>
      <head>
        <title>Payment Voucher - {trip.tripId}</title>
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }
            body {
              margin: 1.6cm;
            }
          }
        `}</style>
      </head>
      <body>
        <PrintableVoucher trip={trip} />
      </body>
    </html>
  );
};

export default PrintableVoucherWrapper;

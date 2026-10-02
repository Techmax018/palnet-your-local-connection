UPDATE public.transactions t SET mpesa_receipt_number = v.r, status = 'completed'
FROM (VALUES ('PN47C66AAFDEFB44F3BFCC','UJ2ID8PYEQ'),('PNB6F4A0DCF10944818AEE','UJ10P8HPG5'),('PNMUID5TRU','UIQID803AB'),('PNMUCA0GSU','UIMID7HGFZ'),('PNMUB9RM9E','UILID7EDZK')) AS v(ref, r)
WHERE t.transaction_reference = v.ref AND t.mpesa_receipt_number IS NULL;
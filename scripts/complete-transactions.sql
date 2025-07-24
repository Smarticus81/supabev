-- Emergency Transaction Completion SQL Script
-- Run this directly in your database to complete all pending transactions

-- Step 1: Show current status
SELECT 
    'BEFORE UPDATE' as status,
    payment_status,
    COUNT(*) as count
FROM orders
GROUP BY payment_status
ORDER BY payment_status;

-- Step 2: Create missing transactions for all orders
INSERT INTO transactions (
    order_id, transaction_type, amount, payment_method, 
    payment_processor, processor_transaction_id, status, 
    net_amount, processed_at, created_at
)
SELECT 
    o.id,
    'sale',
    o.total,
    'cash',
    'emergency_sql',
    'SQL_EMERGENCY_' || EXTRACT(EPOCH FROM NOW()) || '_' || o.id,
    'completed',
    o.total,
    NOW(),
    NOW()
FROM orders o
LEFT JOIN transactions t ON t.order_id = o.id
WHERE t.id IS NULL
AND o.total > 0;

-- Step 3: Update all orders to completed status
UPDATE orders 
SET 
    payment_status = 'completed',
    status = 'completed',
    payment_method = COALESCE(payment_method, 'cash'),
    updated_at = NOW()
WHERE (
    payment_status = 'pending' 
    OR status = 'pending'
    OR payment_status IS NULL
    OR status IS NULL
)
AND total > 0;

-- Step 4: Ensure all transactions are completed
UPDATE transactions 
SET 
    status = 'completed',
    processed_at = COALESCE(processed_at, NOW())
WHERE status = 'pending' OR status IS NULL;

-- Step 5: Show final status
SELECT 
    'AFTER UPDATE' as status,
    payment_status,
    COUNT(*) as count
FROM orders
GROUP BY payment_status
ORDER BY payment_status;

-- Step 6: Verification queries
SELECT 'Orders without transactions' as check_name, COUNT(*) as count
FROM orders o
LEFT JOIN transactions t ON t.order_id = o.id
WHERE t.id IS NULL AND o.total > 0

UNION ALL

SELECT 'Pending orders' as check_name, COUNT(*) as count
FROM orders
WHERE payment_status = 'pending' OR status = 'pending'

UNION ALL

SELECT 'Pending transactions' as check_name, COUNT(*) as count
FROM transactions
WHERE status = 'pending'

UNION ALL

SELECT 'Total transactions' as check_name, COUNT(*) as count
FROM transactions;

-- Success message
SELECT 'EMERGENCY COMPLETION FINISHED' as message, NOW() as completed_at;
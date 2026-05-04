Great! Let me help you test all Order APIs using Postman. Here's a complete guide:

## Postman Collection for Order APIs

### 1. **Create Order** - `POST /api/orders/create`

**URL:** `http://localhost:5000/api/orders/create`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body (Cash on Delivery with Address):**
```json
{
  "paymentMethod": "cash_on_delivery",
  "orderItems": [
    {
      "product": "69f0c738f149a7ce3851e456",
      "name": "Compact Fan",
      "image": "https://example.com/fan.jpg",
      "price": 699,
      "quantity": 2,
      "seller": "69f0c738f149a7ce3851e456"
    }
  ],
  "itemsPrice": 1398,
  "taxPrice": 0,
  "shippingPrice": 110,
  "discountPrice": 0,
  "shippingAddress": {
    "name": "John Doe",
    "street": "123 Main Street",
    "city": "Dhaka",
    "state": "Dhaka",
    "postalCode": "1212",
    "country": "Bangladesh",
    "phone": "01815391792",
    "email": "john@example.com"
  },
  "notes": "Please call before delivery"
}
```

**Request Body (with Collection Point/Pickup):**
```json
{
  "paymentMethod": "cash_on_delivery",
  "orderItems": [
    {
      "product": "69f0c738f149a7ce3851e456",
      "name": "Compact Fan",
      "image": "https://example.com/fan.jpg",
      "price": 699,
      "quantity": 1,
      "seller": "69f0c738f149a7ce3851e456"
    }
  ],
  "itemsPrice": 699,
  "taxPrice": 0,
  "shippingPrice": 0,
  "discountPrice": 0,
  "collectionPoint": {
    "name": "Click N Pick Collection Point",
    "address": "House #12, Road #5, Sector #6, Uttara, Dhaka-1230",
    "fee": 0
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "order": {
    "_id": "69f88e5717a47997c1c0775a",
    "orderId": "ORD-12345678ABCD",
    "user": "69f0c738f149a7ce3851e456",
    "paymentMethod": "cash_on_delivery",
    "status": "pending",
    "totalPrice": 809,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 2. **Get All User Orders** - `GET /api/orders`

**URL:** `http://localhost:5000/api/orders`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Optional Query Parameters:**
- `page=1` - Page number
- `limit=10` - Items per page
- `status=pending` - Filter by status (pending, confirmed, shipped, delivered, cancelled)

**Example with filters:**
```
http://localhost:5000/api/orders?page=1&limit=5&status=delivered
```

**Expected Response:**
```json
{
  "success": true,
  "orders": [
    {
      "_id": "69f88e5717a47997c1c0775a",
      "orderId": "ORD-12345678ABCD",
      "status": "pending",
      "totalPrice": 809,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "orderItems": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### 3. **Get Order by ID** - `GET /api/orders/:id`

**URL:** `http://localhost:5000/api/orders/69f88e5717a47997c1c0775a`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "order": {
    "_id": "69f88e5717a47997c1c0775a",
    "orderId": "ORD-12345678ABCD",
    "user": {
      "_id": "69f0c738f149a7ce3851e456",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "01815391792"
    },
    "shippingAddress": {
      "name": "John Doe",
      "street": "123 Main Street",
      "city": "Dhaka",
      "state": "Dhaka",
      "postalCode": "1212",
      "country": "Bangladesh",
      "phone": "01815391792"
    },
    "orderItems": [
      {
        "product": {
          "_id": "69f0c738f149a7ce3851e456",
          "name": "Compact Fan",
          "images": [...]
        },
        "name": "Compact Fan",
        "price": 699,
        "quantity": 2
      }
    ],
    "paymentMethod": "cash_on_delivery",
    "itemsPrice": 1398,
    "shippingPrice": 110,
    "totalPrice": 1508,
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 4. **Track Order Status** - `GET /api/orders/:id/track`

**URL:** `http://localhost:5000/api/orders/69f88e5717a47997c1c0775a/track`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "tracking": {
    "status": "pending",
    "estimatedDelivery": null,
    "timeline": [
      {
        "status": "Order Placed",
        "completed": true,
        "timestamp": "2024-01-01T00:00:00.000Z",
        "description": "Your order has been placed successfully"
      },
      {
        "status": "Order Confirmed",
        "completed": false,
        "description": "Your order has been confirmed and is being processed"
      }
    ]
  }
}
```

---

### 5. **Cancel Order** - `PUT /api/orders/:id/cancel`

**URL:** `http://localhost:5000/api/orders/69f88e5717a47997c1c0775a/cancel`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "order": {
    "_id": "69f88e5717a47997c1c0775a",
    "status": "cancelled",
    "cancelledAt": "2024-01-01T00:00:00.000Z",
    "cancelReason": "Changed my mind"
  }
}
```

---

### 6. **Request Return** - `POST /api/orders/:id/return`

**URL:** `http://localhost:5000/api/orders/69f88e5717a47997c1c0775a/return`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Product is defective",
  "itemId": "69f88e5717a47997c1c0775a",
  "quantity": 1,
  "comments": "The fan is not working properly"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Return request submitted successfully",
  "returnRequest": {
    "status": "pending",
    "requestedAt": "2024-01-01T00:00:00.000Z",
    "refundAmount": 699
  }
}
```

---

### 7. **Get Order Statistics** - `GET /api/orders/stats/summary`

**URL:** `http://localhost:5000/api/orders/stats/summary`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "stats": {
    "pending": { "count": 1, "amount": 1508 },
    "confirmed": { "count": 0, "amount": 0 },
    "shipped": { "count": 0, "amount": 0 },
    "delivered": { "count": 2, "amount": 5000 },
    "cancelled": { "count": 0, "amount": 0 },
    "totalOrders": 3,
    "totalSpent": 5000
  }
}
```

---

### 8. **Download Invoice** - `GET /api/orders/:id/invoice`

**URL:** `http://localhost:5000/api/orders/69f88e5717a47997c1c0775a/invoice`

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Invoice download feature coming soon",
  "orderId": "69f88e5717a47997c1c0775a"
}
```

---

## Postman Collection JSON Export

Save this as a Postman collection:

```json
{
  "info": {
    "name": "Order API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Create Order",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}",
            "type": "text"
          },
          {
            "key": "Content-Type",
            "value": "application/json",
            "type": "text"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"paymentMethod\": \"cash_on_delivery\",\n  \"orderItems\": [\n    {\n      \"product\": \"69f0c738f149a7ce3851e456\",\n      \"name\": \"Test Product\",\n      \"price\": 699,\n      \"quantity\": 1,\n      \"seller\": \"69f0c738f149a7ce3851e456\"\n    }\n  ],\n  \"itemsPrice\": 699,\n  \"taxPrice\": 0,\n  \"shippingPrice\": 110,\n  \"discountPrice\": 0,\n  \"shippingAddress\": {\n    \"name\": \"Test User\",\n    \"street\": \"Test Street\",\n    \"city\": \"Dhaka\",\n    \"state\": \"Dhaka\",\n    \"postalCode\": \"1212\",\n    \"country\": \"Bangladesh\",\n    \"phone\": \"01815391792\"\n  }\n}"
        },
        "url": {
          "raw": "http://localhost:5000/api/orders/create",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "orders", "create"]
        }
      }
    },
    {
      "name": "Get All Orders",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/orders",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "orders"]
        }
      }
    },
    {
      "name": "Get Order by ID",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/orders/{{ORDER_ID}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "orders", "{{ORDER_ID}}"]
        }
      }
    },
    {
      "name": "Track Order",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/orders/{{ORDER_ID}}/track",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "orders", "{{ORDER_ID}}", "track"]
        }
      }
    },
    {
      "name": "Cancel Order",
      "request": {
        "method": "PUT",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}",
            "type": "text"
          },
          {
            "key": "Content-Type",
            "value": "application/json",
            "type": "text"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"reason\": \"Changed my mind\"\n}"
        },
        "url": {
          "raw": "http://localhost:5000/api/orders/{{ORDER_ID}}/cancel",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "orders", "{{ORDER_ID}}", "cancel"]
        }
      }
    },
    {
      "name": "Order Statistics",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{TOKEN}}",
            "type": "text"
          }
        ],
        "url": {
          "raw": "http://localhost:5000/api/orders/stats/summary",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["api", "orders", "stats", "summary"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "TOKEN",
      "value": "your_jwt_token_here"
    },
    {
      "key": "ORDER_ID",
      "value": "69f88e5717a47997c1c0775a"
    }
  ]
}
```

## How to Test Step by Step:

1. **First, login** to get your JWT token
2. **Create an order** - Copy the `_id` from response
3. **Test GET /orders** - Should show your orders
4. **Test GET /orders/:id** - Use the order ID from step 2
5. **Test GET /orders/:id/track** - Track the order status
6. **Test PUT /orders/:id/cancel** - Cancel the order (if pending)
7. **Test GET /orders/stats/summary** - Get your order statistics

## Common Issues & Solutions:

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Make sure token is valid and not expired |
| 403 Forbidden | Check if the order belongs to the logged-in user |
| 404 Not Found | Order ID doesn't exist |
| 400 Bad Request | Missing required fields in request body |

**Note:** Replace `YOUR_JWT_TOKEN` with an actual token from login, and `ORDER_ID` with a real order ID from your database.
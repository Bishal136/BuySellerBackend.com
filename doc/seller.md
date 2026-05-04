# Seller API Documentation

## Base URL

```
http://localhost:5000/api/seller
```

## Authentication

All seller endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 1. Seller Registration

### Register as Seller //Api is working

```http
POST /api/seller/register
```

**Request Body:**

```json
{
  "storeName": "TechGadgets Store",
  "businessName": "TechGadgets Trading LLC",
  "businessEmail": "business@techgadgets.com",
  "businessPhone": "+8801234567890",
  "businessAddress": {
    "street": "123 Commercial Area",
    "city": "Dhaka",
    "state": "Dhaka",
    "postalCode": "1212",
    "country": "Bangladesh"
  },
  "taxId": "TAX-123456789"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Seller registration submitted for verification",
  "seller": {
    "_id": "seller_id",
    "storeName": "TechGadgets Store",
    "verificationStatus": "pending"
  }
}
```

---

## 2. Dashboard & Analytics

### Get Dashboard Stats

```http
GET /api/seller/dashboard
```

**Response:**

```json
{
  "success": true,
  "stats": {
    "totalSales": 150,
    "totalRevenue": 125000,
    "totalOrders": 45,
    "totalProducts": 12,
    "pendingOrders": 5,
    "processingOrders": 3,
    "shippedOrders": 2,
    "deliveredOrders": 35,
    "cancelledOrders": 0,
    "todaySales": 3,
    "todayRevenue": 8500,
    "weeklySales": 12,
    "weeklyRevenue": 32000,
    "monthlySales": 45,
    "monthlyRevenue": 125000,
    "yearlySales": 150,
    "yearlyRevenue": 125000,
    "lowStockProducts": [],
    "outOfStockProducts": [],
    "rating": {
      "average": 4.5,
      "count": 28
    }
  }
}
```

### Get Sales Analytics

```http
GET /api/seller/analytics?period=weekly   //api is working
```

**Query Parameters:**
| Parameter | Values | Default |
|-----------|--------|---------|
| period | daily, weekly, monthly, yearly | weekly |

**Response:**

```json
{
  "success": true,
  "analytics": {
    "salesData": [
      { "_id": "Week 1", "totalSales": 10, "totalRevenue": 25000 },
      { "_id": "Week 2", "totalSales": 12, "totalRevenue": 30000 }
    ],
    "topProducts": [
      {
        "product": {
          "_id": "product_id",
          "name": "Product Name",
          "price": 999
        },
        "totalSold": 50,
        "totalRevenue": 49950
      }
    ],
    "period": "weekly"
  }
}
```

### Get Recent Orders

```http
GET /api/seller/recent-orders?limit=10     //api is working
```

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| limit | number | 10 |

**Response:**

```json
{
  "success": true,
  "orders": [
    {
      "_id": "order_id",
      "orderId": "order_id",
      "customer": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "items": [],
      "totalAmount": 2999,
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get Low Stock Products

```http
GET /api/seller/low-stock?threshold=10    //api is working
```

**Query Parameters:**
| Parameter | Type | Default |
|-----------|------|---------|
| threshold | number | 10 |

**Response:**

```json
{
  "success": true,
  "products": [
    {
      "_id": "product_id",
      "name": "Product Name",
      "sku": "SKU123",
      "stock": 5,
      "price": 999
    }
  ],
  "count": 1
}
```

---

## 3. Seller Profile

### Get Seller Profile

```http
GET /api/seller/profile      //api is working
```

**Response:**

```json
{
  "success": true,
  "seller": {
    "_id": "seller_id",
    "storeName": "TechGadgets Store",
    "storeSlug": "techgadgets-store",
    "storeDescription": "Best electronics store",
    "storeLogo": "https://...",
    "storeBanner": "https://...",
    "businessName": "TechGadgets Trading LLC",
    "businessEmail": "business@techgadgets.com",
    "businessPhone": "+8801234567890",
    "verificationStatus": "verified",
    "totalSales": 150,
    "totalRevenue": 125000,
    "rating": { "average": 4.5, "count": 28 }
  }
}
```

### Update Seller Profile

```http
PUT /api/seller/profile   
```

**Request Body:**

```json
{
  "storeName": "New Store Name",
  "storeDescription": "Updated description",
  "storeLogo": "https://new-logo-url.com/logo.png",
  "storeBanner": "https://new-banner-url.com/banner.jpg"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Seller profile updated successfully",
  "seller": { ... }
}
```

---

## 4. Product Management

### Get Seller Products

```http
GET /api/seller/products?page=1&limit=20&  ////api is working
```

**Query Parameters:**
| Parameter | Values | Default |
|-----------|--------|---------|
| page | number | 1 |
| limit | number | 20 |
| status | active, inactive, draft, all | all |
| search | string | - |

**Response:**

```json
{
  "success": true,
  "products": [
    {
      "_id": "product_id",
      "name": "iPhone 15 Pro Max",
      "price": 159990,
      "stock": 50,
      "status": "active",
      "images": []
    }
  ],
  "summary": {
    "total": 12,
    "active": 8,
    "inactive": 2,
    "draft": 2,
    "lowStock": 3,
    "outOfStock": 1
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1
  }
}
```

### Get Single Product

```http
GET /api/seller/products/:productId  //api is working
```

**Response:**

```json
{
  "success": true,
  "product": {
    "_id": "product_id",
    "name": "iPhone 15 Pro Max",
    "description": "Product description...",
    "price": 159990,
    "comparePrice": 179990,
    "stock": 50,
    "sku": "IP15PM-256",
    "category": { "_id": "cat_id", "name": "Electronics" },
    "brand": "Apple",
    "tags": ["smartphone", "apple"],
    "images": [],
    "status": "active"
  }
}
```

### Create Product

```http
POST /api/seller/products
```

**Request Body:**

```json
{
  "name": "iPhone 15 Pro Max",
  "description": "Latest flagship smartphone with A17 Pro chip",
  "shortDescription": "Apple's most powerful iPhone ever",
  "price": 159990,
  "comparePrice": 179990,
  "stock": 50,
  "sku": "IP15PM-256",
  "category": "category_id",
  "brand": "Apple",
  "tags": ["smartphone", "apple", "premium"],
  "specifications": {
    "Display": "6.7-inch Super Retina XDR",
    "Processor": "A17 Pro Chip",
    "Camera": "48MP + 12MP + 12MP"
  },
  "images": [
    {
      "url": "https://image-url.com/photo.jpg",
      "publicId": "image_public_id",
      "isPrimary": true
    }
  ],
  "status": "active"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Product created successfully",
  "product": { ... }
}
```

### Update Product

```http
PUT /api/seller/products/:productId
```

**Request Body:** (same as create, only include fields to update)

**Response:**

```json
{
  "success": true,
  "message": "Product updated successfully",
  "product": { ... }
}
```

### Update Product Status

```http
PUT /api/seller/products/:productId/status
```

**Request Body:**

```json
{
  "status": "active"
}
```

_Status options: active, inactive, draft_

**Response:**

```json
{
  "success": true,
  "message": "Product published",
  "product": { ... }
}
```

### Delete Product

```http
DELETE /api/seller/products/:productId
```

**Response:**

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

### Duplicate Product

```http
POST /api/seller/products/:productId/duplicate
```

**Response:**

```json
{
  "success": true,
  "message": "Product duplicated successfully",
  "product": { ... }
}
```

---

## 5. Image Management

### Upload Single Image

```http
POST /api/seller/products/upload-image
```

**Request Body:** form-data

```
image: [file]
```

**Response:**

```json
{
  "success": true,
  "imageUrl": "https://cloudinary.com/image.jpg",
  "publicId": "products/image123",
  "message": "Image uploaded successfully"
}
```

### Upload Multiple Images

```http
POST /api/seller/products/upload-images
```

**Request Body:** form-data

```
images: [file1, file2, file3]
```

**Response:**

```json
{
  "success": true,
  "images": [
    { "url": "https://...", "publicId": "id1", "isPrimary": false },
    { "url": "https://...", "publicId": "id2", "isPrimary": false }
  ],
  "message": "2 images uploaded successfully"
}
```

### Delete Product Image

```http
DELETE /api/seller/products/:productId/images/:imageId
```

**Response:**

```json
{
  "success": true,
  "message": "Image deleted successfully",
  "images": []
}
```

### Set Primary Image

```http
PUT /api/seller/products/:productId/images/:imageId/primary
```

**Response:**

```json
{
  "success": true,
  "message": "Primary image updated",
  "images": []
}
```

---

## 6. Inventory Management

### Get Inventory

```http
GET /api/seller/inventory?page=1&limit=20&stockStatus=low&search=phone
```

**Query Parameters:**
| Parameter | Values | Default |
|-----------|--------|---------|
| page | number | 1 |
| limit | number | 20 |
| stockStatus | all, low, out | all |
| search | string | - |

**Response:**

```json
{
  "success": true,
  "products": [
    {
      "_id": "product_id",
      "name": "iPhone 15",
      "sku": "IP15-256",
      "stock": 5,
      "price": 159990
    }
  ],
  "stats": {
    "totalProducts": 12,
    "lowStock": 3,
    "outOfStock": 1,
    "totalValue": 1250000
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1
  }
}
```

### Bulk Update Stock

```http
PUT /api/seller/inventory/bulk-stock
```

**Request Body:**

```json
{
  "updates": [
    { "productId": "product_id_1", "newStock": 50 },
    { "productId": "product_id_2", "newStock": 100 }
  ],
  "reason": "restock",
  "note": "New shipment received"
}
```

**Response:**

```json
{
  "success": true,
  "message": "2 products updated",
  "results": [
    {
      "productId": "product_id_1",
      "name": "iPhone 15",
      "success": true,
      "previousStock": 30,
      "newStock": 50
    },
    {
      "productId": "product_id_2",
      "name": "MacBook",
      "success": true,
      "previousStock": 20,
      "newStock": 100
    }
  ]
}
```

### Get Stock Logs

```http
GET /api/seller/stock-logs?page=1&limit=50
```

**Response:**

```json
{
  "success": true,
  "logs": [
    {
      "_id": "log_id",
      "product": { "_id": "product_id", "name": "iPhone 15", "sku": "SKU123" },
      "previousStock": 30,
      "newStock": 50,
      "adjustment": 20,
      "reason": "restock",
      "note": "New shipment",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 25, "pages": 1 }
}
```

---

## 7. Order Management

### Get Seller Orders

```http
GET /api/seller/orders?page=1&limit=20&status=pending
```

**Query Parameters:**
| Parameter | Values | Default |
|-----------|--------|---------|
| page | number | 1 |
| limit | number | 20 |
| status | all, pending, processing, shipped, delivered, cancelled | all |
| startDate | YYYY-MM-DD | - |
| endDate | YYYY-MM-DD | - |

**Response:**

```json
{
  "success": true,
  "orders": [
    {
      "_id": "order_id",
      "orderId": "order_id",
      "customer": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+8801234567890"
      },
      "items": [
        {
          "product": { "_id": "product_id", "name": "iPhone 15", "images": [] },
          "quantity": 1,
          "price": 159990
        }
      ],
      "totalAmount": 159990,
      "status": "pending",
      "paymentMethod": "cash_on_delivery",
      "createdAt": "2024-01-15T10:30:00Z",
      "shippingAddress": {
        "name": "John Doe",
        "street": "123 Main St",
        "city": "Dhaka",
        "phone": "+8801234567890"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}
```

### Update Order Status

```http
PUT /api/seller/orders/:orderId/status
```

**Request Body:**

```json
{
  "status": "shipped",
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Order status updated successfully",
  "order": { ... }
}
```

### Process Return Request

```http
PUT /api/seller/orders/:orderId/return
```

**Request Body:**

```json
{
  "action": "approve",
  "refundAmount": 159990,
  "adminComments": "Return approved due to defective product"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Return request approved successfully",
  "order": { ... }
}
```

### Generate Shipping Label

```http
POST /api/seller/orders/:orderId/shipping-label
```

**Response:** PDF file download

---

## 8. Reports

### Get Revenue Report

```http
GET /api/seller/reports/revenue?startDate=2024-01-01&endDate=2024-12-31&groupBy=month
```

**Query Parameters:**
| Parameter | Values | Default |
|-----------|--------|---------|
| startDate | YYYY-MM-DD | - |
| endDate | YYYY-MM-DD | - |
| groupBy | day, month, year | day |

**Response:**

```json
{
  "success": true,
  "revenueData": [
    { "_id": "2024-01", "revenue": 125000, "orders": 15 },
    { "_id": "2024-02", "revenue": 150000, "orders": 18 }
  ],
  "summary": {
    "totalRevenue": 275000,
    "totalOrders": 33,
    "avgOrderValue": 8333.33
  }
}
```

### Export Report

```http
GET /api/seller/reports/export?type=orders&startDate=2024-01-01&endDate=2024-12-31
```

**Query Parameters:**
| Parameter | Values | Default |
|-----------|--------|---------|
| type | orders, products | orders |
| startDate | YYYY-MM-DD | - |
| endDate | YYYY-MM-DD | - |

**Response:** Excel file (.xlsx) download

---

## 9. Communication

### Send Message to Customer

```http
POST /api/seller/messages
```

**Request Body:**

```json
{
  "receiverId": "customer_user_id",
  "orderId": "order_id",
  "subject": "Order Update",
  "message": "Your order has been shipped. Tracking number: 1Z999AA10123456784",
  "attachments": []
}
```

**Response:**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "_id": "message_id",
    "subject": "Order Update",
    "message": "Your order has been shipped...",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Messages

```http
GET /api/seller/messages
```

**Response:**

```json
{
  "success": true,
  "messages": [
    {
      "_id": "message_id",
      "sender": { "_id": "user_id", "name": "John Doe" },
      "receiver": { "_id": "user_id", "name": "Seller Name" },
      "subject": "Order Update",
      "message": "Your order has been shipped...",
      "isRead": false,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## 10. Disputes

### Get Disputes

```http
GET /api/seller/disputes
```

**Response:**

```json
{
  "success": true,
  "disputes": [
    {
      "_id": "dispute_id",
      "order": { "_id": "order_id", "totalPrice": 159990 },
      "customer": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "reason": "product_not_received",
      "description": "Product not received after 15 days",
      "status": "open",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Resolve Dispute

```http
PUT /api/seller/disputes/:disputeId
```

**Request Body:**

```json
{
  "resolution": "refund",
  "resolutionAmount": 159990,
  "resolutionNotes": "Customer will receive full refund"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Dispute resolved successfully",
  "dispute": { ... }
}
```

---

## 11. Store Settings

### Update Store Settings

```http
PUT /api/seller/store-settings
```

**Request Body:**

```json
{
  "storeLogo": "https://logo-url.com/logo.png",
  "storeBanner": "https://banner-url.com/banner.jpg",
  "storeDescription": "Best electronics store in Bangladesh",
  "policies": {
    "returnPolicy": "30-day return policy",
    "shippingPolicy": "Free shipping on orders over ৳5,000"
  },
  "shippingZones": [
    {
      "name": "Domestic",
      "countries": ["Bangladesh"],
      "cost": 100,
      "freeShippingThreshold": 5000
    }
  ],
  "taxSettings": {
    "taxRate": 10,
    "isTaxIncluded": false
  },
  "payoutSettings": {
    "payoutMethod": "bank",
    "payoutDetails": {
      "accountHolderName": "John Doe",
      "accountNumber": "1234567890",
      "bankName": "SBI Bank"
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Store settings updated successfully",
  "seller": { ... }
}
```

---

## 12. Categories

### Get Categories for Seller

```http
GET /api/seller/categories
```

**Response:**

```json
{
  "success": true,
  "categories": [
    { "_id": "cat_id", "name": "Electronics", "slug": "electronics" },
    { "_id": "cat_id", "name": "Fashion", "slug": "fashion" }
  ]
}
```

---

## Error Responses

### Authentication Error (401)

```json
{
  "success": false,
  "message": "Not authorized to access this route"
}
```

### Validation Error (400)

```json
{
  "success": false,
  "message": "Please provide all required fields"
}
```

### Not Found (404)

```json
{
  "success": false,
  "message": "Product not found"
}
```

### Server Error (500)

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Postman Collection Variables

Create these environment variables in Postman:

| Variable     | Value                   |
| ------------ | ----------------------- |
| `base_url`   | `http://localhost:5000` |
| `token`      | `your_jwt_token_here`   |
| `seller_id`  | `seller_id_here`        |
| `product_id` | `product_id_here`       |
| `order_id`   | `order_id_here`         |

---

## Testing Flow

1. **Login as seller** → Get token
2. **Register as seller** → Create seller profile
3. **Get dashboard stats** → Verify data
4. **Create product** → Get product_id
5. **Upload images** → Add product images
6. **Get inventory** → Check stock levels
7. **Get orders** → View customer orders
8. **Update order status** → Process orders
9. **Generate reports** → Export data

This API documentation covers all seller endpoints! 🚀

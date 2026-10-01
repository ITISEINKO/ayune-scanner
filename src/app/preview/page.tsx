"use client";

import { useState } from "react";
import { ProductSheet, type Product } from "@/components/product-sheet";
import { toast } from "sonner";
import { calculateStock, type TransactionType } from "@/lib/stock";

const previewProduct: Product = {
	id: "preview",
	name: "Produk Contoh",
	sku: "1234567890123",
	currentStock: 24,
	rak: "A-03",
	brand: "Demo Brand",
};

export default function PreviewPage() {
	const [stock, setStock] = useState(previewProduct.currentStock);
	const savePreview = async ({ type, qty }: { type: TransactionType; qty: number }) => {
		setStock((current) => Math.max(0, calculateStock(current, type, qty)));
		toast.success("Berhasil", { description: "Stok preview diperbarui." });
	};

	return <ProductSheet product={{ ...previewProduct, currentStock: stock }} onClose={() => window.history.back()} onSubmit={savePreview} />;
}

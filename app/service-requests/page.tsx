"use client";

import { useEffect, useState } from "react";

type RequestData = {
	receivedAt: string;
	body: unknown;
};

export default function ServiceRequestsPage() {
	const [requests, setRequests] = useState<RequestData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showAll, setShowAll] = useState(false);

	const fetchRequest = async () => {
		try {
			const response = await fetch("/api/service-requests", {
				cache: "no-store",
			});

			if (!response.ok) {
				throw new Error("Failed to fetch request");
			}

			const data = await response.json();
			const allRequests = (data.requests ?? []) as RequestData[];

			setRequests(allRequests);
			setError(null);
		} catch (err) {
			console.error(err);
			setError("Unable to load service request.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const initialFetch = async () => {
			await fetchRequest();
		};

		initialFetch();

		const interval = setInterval(() => {
			fetchRequest();
		}, 2000);

		return () => clearInterval(interval);
	}, []);

	return (
		<main
			style={{
				minHeight: "100vh",
				padding: "40px",
				background: "#f5f5f5",
				fontFamily: "Arial, sans-serif",
			}}
		>
			<div
				style={{
					maxWidth: "1000px",
					margin: "0 auto",
				}}
			>
				<h1 style={{ marginBottom: "8x" }}>Service Request Receiver</h1>

				<p style={{ color: "#666", marginBottom: "30px" }}>
					Temporary development monitor for incoming RailNexus requests.
				</p>

				{loading && !requests.length && (
					<div
						style={{
							background: "white",
							padding: "30px",
							borderRadius: "10px",
						}}
					>
						Loading...
					</div>
				)}

				{error && (
					<div
						style={{
							background: "#fee2e2",
							color: "#991b1b",
							padding: "15px",
							borderRadius: "8px",
							marginBottom: "20px",
						}}
					>
						{error}
					</div>
				)}

				{!loading && !error && (
					<>
						<div style={{ marginBottom: "12px" }}>
							<button
								type="button"
								onClick={() => setShowAll(!showAll)}
								style={{
									marginRight: "12px",
									padding: "8px 16px",
									border: "none",
									borderRadius: "6px",
									cursor: "pointer",
									background: showAll ? "#111827" : "#3b82f6",
									color: "white",
								}}
							>
								{showAll ? "Show latest" : "Show all"}
							</button>
						</div>

						{showAll ? (
							<div
								style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}
							>
								<h3>Latest request</h3>
							</div>
						) : (
							<div
								style={{ borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}
							>
								<h3>Latest request</h3>
							</div>
						)}

						{/* <!-- Requests list or single request --> */}
						{showAll ? (
							requests.length > 0 ? (
								<div>
									{requests.map((req, i) => (
										<div
											key={i}
											style={{
												background: "#f3f4f6",
												color: "#1f2937",
												padding: "15px",
												borderRadius: "8px",
												marginBottom: "12px",
												borderLeft: "3px solid #3b82f6",
											}}
										>
											<div>
												<strong>Request #{i + 1}</strong> received{" "}
												{new Date(req.receivedAt).toLocaleString()}
											</div>
											<pre
												style={{
													margin: 0,
													whiteSpace: "pre-wrap",
													wordBreak: "break-word",
													fontSize: "12px",
												}}
											>
												{JSON.stringify(req.body, null, 2)}
											</pre>
										</div>
									))}
								</div>
							) : (
								<div>No requests received yet</div>
							)
						) : requests.length > 0 ? (
							<>
								<div
									style={{
										background: "#dcfce7",
										color: "#166534",
										padding: "15px",
										borderRadius: "8px",
										marginBottom: "20px",
									}}
								>
									Service request received
								</div>

								<div
									style={{
										background: "white",
										padding: "25px",
										borderRadius: "10px",
										marginBottom: "20px",
									}}
								>
									<h2>Request Information</h2>

									<p>
										<strong>Received:</strong>{" "}
										{new Date(
											requests[requests.length - 1].receivedAt,
										).toLocaleString()}
									</p>
								</div>

								<div
									style={{
										background: "#111827",
										color: "#f9fafb",
										padding: "25px",
										borderRadius: "10px",
										overflowX: "auto",
									}}
								>
									<h2 style={{ color: "white", marginTop: 0 }}>Request JSON</h2>

									<pre
										style={{
											margin: 0,
											whiteSpace: "pre-wrap",
											wordBreak: "break-word",
											fontSize: "14px",
											lineHeight: "1.6",
										}}
									>
										{JSON.stringify(
											requests[requests.length - 1].body,
											null,
											2,
										)}
									</pre>
								</div>

								<button
									type="button"
									onClick={fetchRequest}
									style={{
										marginTop: "20px",
										padding: "12px 20px",
										border: "none",
										borderRadius: "8px",
										cursor: "pointer",
										background: "#111827",
										color: "white",
									}}
								>
									Refresh
								</button>
							</>
						) : (
							<div
								style={{
									marginTop: "20px",
									background: "#f3f4f6",
									padding: "20px",
									borderRadius: "8px",
								}}
							>
								<h3>No request received yet</h3>
								<p style={{ color: "#666" }}>
									Send a POST request to: <code>/api/service-requests</code>
								</p>
							</div>
						)}
					</>
				)}
			</div>
		</main>
	);
}

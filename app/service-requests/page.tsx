"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RequestData = {
	receivedAt: string;
	body: Record<string, unknown>;
};

type ActionState = "idle" | "working" | "done" | "error";

export default function ServiceRequestsPage() {
	const [requests, setRequests] = useState<RequestData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showAll, setShowAll] = useState(false);
	const [refreshState, setRefreshState] = useState<ActionState>("idle");
	const [clearState, setClearState] = useState<ActionState>("idle");
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const actionRef = useRef<HTMLDivElement>(null);

	const fetchRequest = useCallback(async () => {
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
			setLastUpdated(new Date());
			setError(null);
		} catch (err) {
			console.error(err);
			setError("Unable to load service request.");
		} finally {
			setLoading(false);
		}
	}, []);

	const handleRefresh = async () => {
		if (refreshState === "working") return;
		setRefreshState("working");
		setError(null);
		await fetchRequest();
		setRefreshState("idle");
	};

	const handleRemoveAll = async () => {
		if (clearState === "working") return;
		const confirmed = window.confirm(
			"Remove all received service requests? This cannot be undone.",
		);
		if (!confirmed) return;

		setClearState("working");
		setError(null);
		try {
			const response = await fetch("/api/service-requests", {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to clear requests");
			}

			await fetchRequest();
			setClearState("done");
		} catch (err) {
			console.error(err);
			setError("Unable to remove requests.");
			setClearState("error");
		} finally {
			setTimeout(() => {
				setClearState(
					(prev) => (prev === "done" || prev === "error" ? "idle" : prev),
				);
			}, 2000);
			actionRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	};

	useEffect(() => {
		const initialFetch = async () => {
			await fetchRequest();
		};

		initialFetch();

		const interval = setInterval(() => {
			fetchRequest();
		}, 5000);

		return () => clearInterval(interval);
	}, [fetchRequest]);

	return (
		<main
			style={{
				minHeight: "100vh",
				padding: "32px 20px 64px",
				background: "linear-gradient(180deg, #081a30 0%, #0a2342 100%)",
				fontFamily:
					"'Segoe UI', system-ui, -apple-system, sans-serif",
				color: "#e3ecf7",
			}}
		>
			<div style={{ maxWidth: "1000px", margin: "0 auto" }}>
				<header
					style={{
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "16px",
						marginBottom: "28px",
					}}
				>
					<div>
						<h1
							style={{
								margin: 0,
								fontSize: "26px",
								fontWeight: 700,
								color: "#ffffff",
							}}
						>
							Service Request Receiver
						</h1>
						<p style={{ margin: "6px 0 0", color: "#9fb6d0", fontSize: "14px" }}>
							Live monitor for incoming RailNexus requests.
						</p>
					</div>
					<div id="action-buttons" ref={actionRef}>
						<button
							type="button"
							onClick={handleRefresh}
							disabled={refreshState === "working"}
							style={{
								marginRight: "12px",
								padding: "10px 20px",
								border: "none",
								borderRadius: "8px",
								cursor: "pointer",
								fontSize: "14px",
								fontWeight: 600,
								background: "#2e6fb7",
								color: "#ffffff",
								opacity: refreshState === "working" ? 0.6 : 1,
							}}
						>
							{refreshState === "working" ? "Refreshing..." : "↻ Refresh"}
						</button>

						<button
							type="button"
							onClick={handleRemoveAll}
							disabled={clearState === "working" || requests.length === 0}
							style={{
								padding: "10px 20px",
								border: "none",
								borderRadius: "8px",
								cursor:
									clearState === "working" || requests.length === 0
										? "not-allowed"
										: "pointer",
								fontSize: "14px",
								fontWeight: 600,
								background: "#dc2626",
								color: "#ffffff",
								opacity:
									clearState === "working" || requests.length === 0 ? 0.6 : 1,
							}}
						>
							{clearState === "working"
								? "Removing..."
								: clearState === "done"
									? "✓ Removed"
									: clearState === "error"
										? "✕ Error"
										: "Remove all"}
						</button>
					</div>
				</header>

				{error && (
					<div
						style={{
							background: "rgba(220,38,38,0.12)",
							border: "1px solid rgba(248,113,113,0.4)",
							color: "#fca5a5",
							padding: "14px 18px",
							borderRadius: "8px",
							marginBottom: "20px",
							fontSize: "14px",
						}}
					>
						{error}
					</div>
				)}

				{loading && !requests.length ? (
					<div
						style={{
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.08)",
							padding: "40px",
							borderRadius: "12px",
							textAlign: "center",
							color: "#9fb6d0",
						}}
					>
						Loading...
					</div>
				) : (
					<>
						{/* Toolbar / stats */}
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								gap: "12px",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "16px 18px",
								background: "rgba(255,255,255,0.04)",
								border: "1px solid rgba(255,255,255,0.08)",
								borderRadius: "12px",
								marginBottom: "20px",
							}}
						>
							<div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
								<span style={{ fontSize: "14px", color: "#9fb6d0" }}>
									<strong style={{ color: "#ffffff", fontSize: "20px" }}>
										{requests.length}
									</strong>{" "}
									request{requests.length === 1 ? "" : "s"}
								</span>
								<button
									type="button"
									onClick={() => setShowAll(!showAll)}
									style={{
										padding: "8px 14px",
										border: "none",
										borderRadius: "8px",
										cursor: "pointer",
										fontSize: "13px",
										fontWeight: 600,
										background: "#1e3a5f",
										color: "#ffffff",
									}}
								>
									{showAll ? "Show latest" : "Show all"}
								</button>
							</div>
							<span style={{ fontSize: "13px", color: "#9fb6d0" }}>
								{lastUpdated
									? `Last updated ${lastUpdated.toLocaleTimeString()}`
									: "Not updated yet"}
							</span>
						</div>

						{/* Content */}
						{requests.length === 0 ? (
							<div
								style={{
									marginTop: "8px",
									background: "rgba(255,255,255,0.04)",
									border: "1px dashed rgba(255,255,255,0.15)",
									padding: "40px",
									borderRadius: "12px",
									textAlign: "center",
								}}
							>
								<h3
									style={{ margin: "0 0 8px", color: "#ffffff", fontSize: "17px" }}
								>
									No request received yet
								</h3>
								<p style={{ margin: 0, color: "#9fb6d0", fontSize: "14px" }}>
									Send a POST request to{" "}
									<code
										style={{
											background: "#0e2a4d",
											padding: "2px 6px",
											borderRadius: "4px",
											color: "#7dd3fc",
										}}
									>
										/api/service-requests
									</code>
								</p>
							</div>
						) : showAll ? (
							<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
								{requests.map((req, i) => (
									<div
										key={`${req.receivedAt}-${i}`}
										style={{
											background: "rgba(255,255,255,0.04)",
											border: "1px solid rgba(255,255,255,0.08)",
											borderLeft: "3px solid #2e6fb7",
											borderRadius: "10px",
											padding: "16px 18px",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												gap: "12px",
												marginBottom: "10px",
												flexWrap: "wrap",
											}}
										>
											<strong style={{ color: "#ffffff", fontSize: "14px" }}>
												Request #{i + 1}
											</strong>
											<span style={{ color: "#9fb6d0", fontSize: "12px" }}>
												{new Date(req.receivedAt).toLocaleString()}
											</span>
										</div>
										<pre
											style={{
												margin: 0,
												whiteSpace: "pre-wrap",
												wordBreak: "break-word",
												fontSize: "12px",
												lineHeight: "1.5",
												color: "#c8d9ee",
											}}
										>
											{JSON.stringify(req.body, null, 2)}
										</pre>
									</div>
								))}
							</div>
						) : (
							<>
								<div
									style={{
										background: "rgba(46,111,183,0.15)",
										border: "1px solid rgba(56,189,248,0.35)",
										color: "#7dd3fc",
										padding: "14px 18px",
										borderRadius: "8px",
										marginBottom: "20px",
										fontSize: "14px",
										fontWeight: 600,
									}}
								>
									Latest service request received
								</div>

								<div
									style={{
										background: "rgba(255,255,255,0.04)",
										border: "1px solid rgba(255,255,255,0.08)",
										padding: "20px 24px",
										borderRadius: "12px",
										marginBottom: "20px",
									}}
								>
									<h2
										style={{
											margin: "0 0 12px",
											color: "#ffffff",
											fontSize: "17px",
										}}
									>
										Request Information
									</h2>
									<p style={{ margin: 0, color: "#9fb6d0", fontSize: "14px" }}>
										<strong style={{ color: "#e3ecf7" }}>Received:</strong>{" "}
										{new Date(
											requests[requests.length - 1].receivedAt,
										).toLocaleString()}
									</p>
								</div>

								<div
									style={{
										background: "#0a1020",
										border: "1px solid rgba(255,255,255,0.1)",
										padding: "20px 24px",
										borderRadius: "12px",
										overflowX: "auto",
									}}
								>
									<h2
										style={{
											margin: "0 0 12px",
											color: "#7dd3fc",
											fontSize: "15px",
											textTransform: "uppercase",
											letterSpacing: "0.5px",
										}}
									>
										Request JSON
									</h2>
									<pre
										style={{
											margin: 0,
											whiteSpace: "pre-wrap",
											wordBreak: "break-word",
											fontSize: "13px",
											lineHeight: "1.6",
											color: "#e5edf7",
										}}
									>
										{JSON.stringify(
											requests[requests.length - 1].body,
											null,
											2,
										)}
									</pre>
								</div>
							</>
						)}
					</>
				)}
			</div>
		</main>
	);
}

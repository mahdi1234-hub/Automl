"""
PyCaret AutoML API - FastAPI backend for automated machine learning analysis.
Supports classification, regression, clustering, time series, and anomaly detection.
Uses PyCaret for AutoML with full explainability (SHAP values, feature importance).
"""

import io
import json
import base64
import traceback
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PyCaret AutoML API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalysisRequest(BaseModel):
    data: list[dict]
    columns: list[dict]
    ml_type: str  # classification, regression, clustering, time_series, anomaly_detection
    target: Optional[str] = None
    features: Optional[list[str]] = None
    time_column: Optional[str] = None
    forecast_horizon: Optional[int] = 12
    n_clusters: Optional[int] = None
    fraction: Optional[float] = 0.05  # for anomaly detection


class NumpyEncoder(json.JSONEncoder):
    """Custom JSON encoder for numpy types."""
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        return super().default(obj)


def fig_to_base64(fig) -> str:
    """Convert matplotlib figure to base64 string."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=100, facecolor="#0F0F0E")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pycaret-api"}


@app.post("/analyze")
async def analyze(request: AnalysisRequest):
    try:
        df = pd.DataFrame(request.data)

        if df.empty:
            raise HTTPException(status_code=400, detail="Empty dataset")

        # Convert column types
        for col_info in request.columns:
            col_name = col_info["name"]
            col_type = col_info["type"]
            if col_name in df.columns:
                if col_type == "numeric":
                    df[col_name] = pd.to_numeric(df[col_name], errors="coerce")
                elif col_type == "datetime":
                    df[col_name] = pd.to_datetime(df[col_name], errors="coerce")
                elif col_type == "boolean":
                    df[col_name] = df[col_name].map(
                        {"true": True, "false": False, "yes": True, "no": False, "1": True, "0": False}
                    )

        ml_type = request.ml_type.lower()

        if ml_type == "classification":
            return await run_classification(df, request)
        elif ml_type == "regression":
            return await run_regression(df, request)
        elif ml_type == "clustering":
            return await run_clustering(df, request)
        elif ml_type == "time_series":
            return await run_time_series(df, request)
        elif ml_type == "anomaly_detection":
            return await run_anomaly_detection(df, request)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown ML type: {ml_type}")

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def run_classification(df: pd.DataFrame, request: AnalysisRequest):
    from pycaret.classification import (
        setup, compare_models, pull, get_config,
        plot_model, predict_model, finalize_model
    )

    if not request.target:
        raise HTTPException(status_code=400, detail="Target column required for classification")

    # Setup PyCaret
    s = setup(
        data=df,
        target=request.target,
        session_id=42,
        verbose=False,
        html=False,
    )

    # Compare models
    best_models = compare_models(n_select=5, sort="Accuracy")
    comparison_df = pull()

    # Get best model
    best = best_models[0] if isinstance(best_models, list) else best_models

    # Feature importance
    feature_importance = []
    try:
        if hasattr(best, "feature_importances_"):
            features = get_config("X_train").columns.tolist()
            importances = best.feature_importances_
            feature_importance = [
                {"feature": f, "importance": round(float(i), 4)}
                for f, i in sorted(zip(features, importances), key=lambda x: -abs(x[1]))
            ][:20]
    except Exception:
        pass

    # SHAP values
    shap_values_data = []
    try:
        import shap
        X_train = get_config("X_train")
        explainer = shap.TreeExplainer(best)
        shap_vals = explainer.shap_values(X_train.head(100))
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[0]
        mean_shap = np.abs(shap_vals).mean(axis=0)
        shap_values_data = [
            {"feature": f, "shapValue": round(float(v), 4)}
            for f, v in sorted(zip(X_train.columns.tolist(), mean_shap), key=lambda x: -abs(x[1]))
        ][:20]
    except Exception:
        pass

    # Model comparison data
    model_comparison = []
    for _, row in comparison_df.iterrows():
        model_comparison.append({
            "model": str(row.get("Model", row.name)),
            "accuracy": round(float(row.get("Accuracy", 0)), 4),
            "precision": round(float(row.get("Prec.", row.get("Precision", 0))), 4),
            "recall": round(float(row.get("Recall", 0)), 4),
            "f1": round(float(row.get("F1", 0)), 4),
        })

    # Predictions on test set
    predictions = predict_model(best)
    pred_sample = predictions.head(10).to_dict(orient="records")

    return json.loads(json.dumps({
        "type": "classification",
        "status": "completed",
        "bestModel": str(type(best).__name__),
        "metrics": model_comparison[0] if model_comparison else {},
        "modelComparison": model_comparison,
        "featureImportance": feature_importance,
        "shapValues": shap_values_data,
        "predictionSample": pred_sample,
    }, cls=NumpyEncoder))


async def run_regression(df: pd.DataFrame, request: AnalysisRequest):
    from pycaret.regression import (
        setup, compare_models, pull, get_config,
        predict_model
    )

    if not request.target:
        raise HTTPException(status_code=400, detail="Target column required for regression")

    s = setup(
        data=df,
        target=request.target,
        session_id=42,
        verbose=False,
        html=False,
    )

    best_models = compare_models(n_select=5, sort="R2")
    comparison_df = pull()

    best = best_models[0] if isinstance(best_models, list) else best_models

    # Feature importance
    feature_importance = []
    try:
        if hasattr(best, "feature_importances_"):
            features = get_config("X_train").columns.tolist()
            importances = best.feature_importances_
            feature_importance = [
                {"feature": f, "importance": round(float(i), 4)}
                for f, i in sorted(zip(features, importances), key=lambda x: -abs(x[1]))
            ][:20]
    except Exception:
        pass

    # SHAP values
    shap_values_data = []
    try:
        import shap
        X_train = get_config("X_train")
        explainer = shap.TreeExplainer(best)
        shap_vals = explainer.shap_values(X_train.head(100))
        mean_shap = np.abs(shap_vals).mean(axis=0)
        shap_values_data = [
            {"feature": f, "shapValue": round(float(v), 4)}
            for f, v in sorted(zip(X_train.columns.tolist(), mean_shap), key=lambda x: -abs(x[1]))
        ][:20]
    except Exception:
        pass

    # Model comparison
    model_comparison = []
    for _, row in comparison_df.iterrows():
        model_comparison.append({
            "model": str(row.get("Model", row.name)),
            "rmse": round(float(row.get("RMSE", 0)), 4),
            "mae": round(float(row.get("MAE", 0)), 4),
            "r2": round(float(row.get("R2", 0)), 4),
            "mape": round(float(row.get("MAPE", 0)), 4),
        })

    predictions = predict_model(best)
    pred_sample = predictions.head(10).to_dict(orient="records")

    return json.loads(json.dumps({
        "type": "regression",
        "status": "completed",
        "bestModel": str(type(best).__name__),
        "metrics": model_comparison[0] if model_comparison else {},
        "modelComparison": model_comparison,
        "featureImportance": feature_importance,
        "shapValues": shap_values_data,
        "predictionSample": pred_sample,
    }, cls=NumpyEncoder))


async def run_clustering(df: pd.DataFrame, request: AnalysisRequest):
    from pycaret.clustering import setup, create_model, pull, assign_model, get_config

    # Drop non-numeric columns for clustering
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        raise HTTPException(status_code=400, detail="No numeric columns for clustering")

    s = setup(
        data=numeric_df,
        session_id=42,
        verbose=False,
        html=False,
    )

    n_clusters = request.n_clusters or 4
    model = create_model("kmeans", num_clusters=n_clusters)
    results_df = pull()
    assigned = assign_model(model)

    # Cluster distribution
    cluster_counts = assigned["Cluster"].value_counts().to_dict()
    cluster_distribution = [
        {"id": str(k), "label": str(k), "value": int(v)}
        for k, v in cluster_counts.items()
    ]

    # Cluster centers
    centers = []
    if hasattr(model, "cluster_centers_"):
        for i, center in enumerate(model.cluster_centers_):
            centers.append({
                "cluster": f"Cluster {i}",
                **{col: round(float(val), 4) for col, val in zip(numeric_df.columns, center)}
            })

    return json.loads(json.dumps({
        "type": "clustering",
        "status": "completed",
        "bestModel": "KMeans",
        "nClusters": n_clusters,
        "clusterDistribution": cluster_distribution,
        "clusterCenters": centers,
        "metrics": results_df.to_dict(orient="records") if not results_df.empty else [],
    }, cls=NumpyEncoder))


async def run_time_series(df: pd.DataFrame, request: AnalysisRequest):
    from pycaret.time_series import setup, compare_models, pull, predict_model, finalize_model

    if not request.target:
        raise HTTPException(status_code=400, detail="Target column required for time series")

    # Prepare time series data
    ts_df = df.copy()
    if request.time_column and request.time_column in ts_df.columns:
        ts_df[request.time_column] = pd.to_datetime(ts_df[request.time_column])
        ts_df = ts_df.set_index(request.time_column)
        ts_df = ts_df.sort_index()

    target_series = ts_df[request.target]

    s = setup(
        data=target_series,
        session_id=42,
        verbose=False,
        html=False,
        fh=request.forecast_horizon or 12,
    )

    best_models = compare_models(n_select=3)
    comparison_df = pull()

    best = best_models[0] if isinstance(best_models, list) else best_models
    final = finalize_model(best)
    forecast = predict_model(final, fh=request.forecast_horizon or 12)

    # Format forecast
    forecast_data = []
    if hasattr(forecast, "index"):
        for idx, val in forecast.items():
            forecast_data.append({
                "date": str(idx),
                "forecast": round(float(val), 4),
            })

    # Model comparison
    model_comparison = []
    for _, row in comparison_df.iterrows():
        model_comparison.append({
            "model": str(row.get("Model", row.name)),
            "mae": round(float(row.get("MAE", 0)), 4),
            "rmse": round(float(row.get("RMSSE", row.get("RMSE", 0))), 4),
            "mape": round(float(row.get("MAPE", 0)), 4),
        })

    return json.loads(json.dumps({
        "type": "time_series",
        "status": "completed",
        "bestModel": str(type(best).__name__),
        "forecastHorizon": request.forecast_horizon or 12,
        "forecast": forecast_data,
        "modelComparison": model_comparison,
        "metrics": model_comparison[0] if model_comparison else {},
    }, cls=NumpyEncoder))


async def run_anomaly_detection(df: pd.DataFrame, request: AnalysisRequest):
    from pycaret.anomaly import setup, create_model, assign_model, pull

    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        raise HTTPException(status_code=400, detail="No numeric columns for anomaly detection")

    s = setup(
        data=numeric_df,
        session_id=42,
        verbose=False,
        html=False,
    )

    model = create_model("iforest", fraction=request.fraction or 0.05)
    results = assign_model(model)

    anomaly_count = int(results["Anomaly"].sum())
    total_count = len(results)

    # Get anomaly samples
    anomalies = results[results["Anomaly"] == 1].head(20).to_dict(orient="records")

    return json.loads(json.dumps({
        "type": "anomaly_detection",
        "status": "completed",
        "bestModel": "Isolation Forest",
        "totalRecords": total_count,
        "anomalyCount": anomaly_count,
        "anomalyRate": round(anomaly_count / total_count * 100, 2),
        "anomalySamples": anomalies,
    }, cls=NumpyEncoder))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

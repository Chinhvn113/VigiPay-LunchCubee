import pandas as pd
import seaborn as sns
# import matplotlib.pyplot as plt
import warnings
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score,confusion_matrix, classification_report
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import numpy as np 

warnings.filterwarnings('ignore')

import joblib
import json
import os


def load_model_pt(path: str):
    """Load a serialized model. If torch is available use torch.load, otherwise use joblib.load.

    Returns the loaded model or raises the underlying exception.
    """
    # Assuming 'random_forest.pkl' exists and was trained with a similar script.
    # If the file does not exist, this will raise an error.
    # Make sure you have the model file in the same directory or provide the correct path.
    if not os.path.exists(path):
        print(f"Error: Model file not found at {path}")
        print("Please ensure 'random_forest.pkl' is in the correct directory.")
        return None

    try:
        model = joblib.load(path)
        print(f"Loaded model from {path}")
        return model
    except Exception as e:
        print(f"Failed to load model from {path}: {e}")
        raise


def load_feature_columns(path: str = 'feature_columns.json'):
    """Load feature column names. Returns the list of expected feature columns.
    
    Feature columns expected by the trained model:
    ['step', 'type', 'amount', 'oldbalanceOrg', 'newbalanceOrig', 'oldbalanceDest', 'newbalanceDest', 'isFlaggedFraud']
    """
    feature_columns = [
        'step', 'type', 'amount', 'oldbalanceOrg', 'newbalanceOrig',
        'oldbalanceDest', 'newbalanceDest', 'isFlaggedFraud'
    ]
    return feature_columns


def predict(model, feature_data, feature_columns=None):
    """
    Makes a prediction using a loaded model on a single sample.
    Automatically maps string 'type' values to their integer encoding.
    
    Accepts input as either a list or a dict.

    Args:
        model: A trained and loaded scikit-learn model object.
        feature_data (list or dict): Feature values. Can be:
                             - List: [step, type, amount, oldbalanceOrg, newbalanceOrig, oldbalanceDest, newbalanceDest]
                                     or [step, type, amount, oldbalanceOrg, newbalanceOrig, oldbalanceDest, newbalanceDest, isFlaggedFraud]
                             - Dict: {"step": 1, "type": 0, "amount": 500.0, ...} (keys are case/format insensitive)
                             The 'type' can be an integer or a string like 'TRANSFER'.
        feature_columns (list, optional): The column names. If not provided, uses the default list.

    Returns:
        dict: {"isFraud": 0 or 1, "probability": float}
    """
    if feature_columns is None:
        feature_columns = [
            'step', 'type', 'amount', 'oldbalanceOrg', 'newbalanceOrig',
            'oldbalanceDest', 'newbalanceDest', 'isFlaggedFraud'
        ]

    if isinstance(feature_data, dict):
        feature_data_lower = {k.lower(): v for k, v in feature_data.items()}
        
        processed_features = []
        for col in feature_columns:
            col_lower = col.lower()
            
            if col_lower in feature_data_lower:
                processed_features.append(feature_data_lower[col_lower])
            elif col == 'isFlaggedFraud':
                processed_features.append(0)
            else:
                raise ValueError(f"Missing required feature: {col}")
    else:
        processed_features = feature_data.copy() if isinstance(feature_data, list) else list(feature_data)

    if len(processed_features) == 7:
        processed_features.append(0)
    elif len(processed_features) != 8:
        raise ValueError(f"Expected 7 or 8 features, but got {len(processed_features)}")

    if isinstance(processed_features[1], str):
        type_mapping = {
            'CASH_IN': 0, 'CASH_OUT': 1, 'DEBIT': 2, 'PAYMENT': 3, 'TRANSFER': 4
        }
        str_type = processed_features[1].upper()
        processed_features[1] = type_mapping.get(str_type, 4)
        print(f"Info: Mapped string type to code '{processed_features[1]}'")

    currency_indices = [2, 3, 4, 5, 6]
    for idx in currency_indices:
        if idx < len(processed_features) and processed_features[idx] is not None:
            processed_features[idx] = float(processed_features[idx]) / 25000
            print(f"Info: Converted feature at index {idx} to USD: {processed_features[idx]}")
    print(f"Info: Converted VND to USD by dividing currency fields by 25000")
    processed_features[0] = 6
    input_df = pd.DataFrame([processed_features], columns=feature_columns)

    prediction = model.predict(input_df)[0]
    conf_threshold = 0.2
    try:
        probabilities = model.predict_proba(input_df)[0]
        fraud_probability = float(probabilities[1]) if len(probabilities) > 1 else 0.0
    except Exception as e:
        print(f"Warning: Could not get probability: {e}")
        fraud_probability = 0.0
    if fraud_probability >= conf_threshold:
        prediction = 1  
    return {
        "isFraud": int(prediction),
        "probability": fraud_probability
    }


if __name__ == "__main__":
    df = pd.read_csv('AIML Dataset.csv')
    print("Original DataFrame Head:")
    print(df.head())

    df.drop(columns=['nameOrig', 'nameDest', "isFlaggedFraud", "newbalanceDest", "oldbalanceDest"], axis=1, inplace=True)
    le = LabelEncoder()
    df['type']  = le.fit_transform(df['type'])
    print("\nDataFrame Info after preprocessing:")
    print(df.info())
    # Print label encoder mapping so it's clear which original category maps to which integer
    try:
        original_to_encoded = {str(cls): int(idx) for idx, cls in enumerate(le.classes_)}
        encoded_to_original = {int(idx): str(cls) for idx, cls in enumerate(le.classes_)}
        print("\nLabelEncoder mapping (original -> encoded):", original_to_encoded)
        print("LabelEncoder mapping (encoded -> original):", encoded_to_original)
    except Exception as e:
        print(f"Could not print label encoder mapping: {e}")

    X = df.drop('isFraud', axis=1)
    y = df['isFraud']
    X_train,X_test, y_train,y_test = train_test_split(X,y , test_size=0.3, random_state=42) 
    model = RandomForestClassifier()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    print("\nModel Evaluation on Test Set:")
    print("Accuracy:", accuracy_score(y_test, y_pred))
    print("Precision:", precision_score(y_test, y_pred))
    print("Recall:", recall_score(y_test, y_pred))
    
    print("exporting model...")
    joblib.dump(model, 'random_forest_org.pkl')
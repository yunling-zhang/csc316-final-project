import pandas as pd

PATH = "../data/PoliceDataAll.csv"
df = pd.read_csv(PATH)

colToDrop = ['EVENT_UNIQUE_ID', 'x', 'y']

df.drop(colToDrop, axis='columns', inplace=True)

df.to_csv("../data/cleaned_data.csv", index=False)

from backend.database.connection import create_tables, engine, Base

def recreate():
    Base.metadata.drop_all(bind=engine)
    create_tables()

if __name__ == "__main__":
    recreate()

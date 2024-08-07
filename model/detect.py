import cv2
import argparse
import numpy as np
from keras.models import load_model
from keras.preprocessing.image import img_to_array
from collections import Counter
import pymongo
import time
from datetime import datetime
from collections import defaultdict, Counter

#database
client=pymongo.MongoClient("mongodb+srv://nisha:face@vsr.hkuuj.mongodb.net/?retryWrites=true&w=majority&appName=vsr")
print(client)
db=client['test']
collection=db['client1']

counter_collection = db['counters']
def initialize_counter(sequence_name):
    if counter_collection.find_one({'_id': sequence_name}):
        print(f"Counter '{sequence_name}' already initialized")
        return
    counter_collection.insert_one({
        '_id': sequence_name,
        'sequence_value': 0
    })

#Uncomment the line below to initialize the counter (run once)
initialize_counter('your_collection_id')

def get_next_sequence_value(sequence_name):
    result = counter_collection.find_one_and_update(
        {'_id': sequence_name},
        {'$inc': {'sequence_value': 1}},
        return_document=True
    )
    return result['sequence_value']

def highlightFace(net, frame, conf_threshold=0.7):
    frameOpencvDnn = frame.copy()
    frameHeight = frameOpencvDnn.shape[0]
    frameWidth = frameOpencvDnn.shape[1]
    blob = cv2.dnn.blobFromImage(frameOpencvDnn, 1.0, (300, 300), [104, 117, 123], True, False)
    net.setInput(blob)
    detections = net.forward()
    faceBoxes = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence > conf_threshold:
            x1 = int(detections[0, 0, i, 3] * frameWidth)
            y1 = int(detections[0, 0, i, 4] * frameHeight)
            x2 = int(detections[0, 0, i, 5] * frameWidth)
            y2 = int(detections[0, 0, i, 6] * frameHeight)
            faceBoxes.append([x1, y1, x2, y2])
            cv2.rectangle(frameOpencvDnn, (x1, y1), (x2, y2), (0, 255, 0), int(round(frameHeight / 150)), 8)
    return frameOpencvDnn, faceBoxes

# Function to calculate the mode of a list
def calculate_mode(predictions):
    return Counter(predictions).most_common(1)[0][0]

# Load models
faceProto = r"C:\Users\patel\Gender-and-Age-Detection-master\opencv_face_detector.pbtxt"
faceModel = r"C:\Users\patel\Gender-and-Age-Detection-master\opencv_face_detector_uint8.pb"
ageProto = r"C:\Users\patel\Gender-and-Age-Detection-master\age_deploy.prototxt"
ageModel = r"C:\Users\patel\Gender-and-Age-Detection-master\age_net.caffemodel"
genderProto = r"C:\Users\patel\Gender-and-Age-Detection-master\gender_deploy.prototxt"
genderModel = r"C:\Users\patel\Gender-and-Age-Detection-master\gender_net.caffemodel"
emotionModelPath = r'C:\Users\patel\Gender-and-Age-Detection-master\model.h5'

MODEL_MEAN_VALUES = (78.4263377603, 87.7689143744, 114.895847746)
ageList =['(0-10)', '(10-20)', '(20-30)', '(30-50)', '(50-60)', '(60-80)']
genderList = ['Male', 'Female']
emotionList = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']

faceNet = cv2.dnn.readNet(faceModel, faceProto)
ageNet = cv2.dnn.readNet(ageModel, ageProto)
genderNet = cv2.dnn.readNet(genderModel, genderProto)
emotionModel = load_model(emotionModelPath)

parser = argparse.ArgumentParser()
parser.add_argument('--image')
args = parser.parse_args()

# Parse arguments for RTSP URL
# parser = argparse.ArgumentParser()
# parser.add_argument('--rtsp_url', type=str, default="rtsp://192.168.1.15:8080/h264_ulaw.sdp", help='RTSP URL for video stream')
# args = parser.parse_args()
# rtsp_url="rtsp://statmodeller@gmail.com:Hiren@123@camera-ip-address:554/stream1"

# Open video capture
# video = cv2.VideoCapture(args.rtsp_url)
# if not video.isOpened():
#     print("Error opening video stream or file")
#     exit(1)

video = cv2.VideoCapture(args.image if args.image else 0)
padding = 20

individual_predictions = defaultdict(lambda: {'age': [], 'gender': [], 'emotion': [], 'centroid': None})
start_time = time.time()
age_predictions = []
gender_predictions = []
emotion_predictions = []

while cv2.waitKey(1) < 0:
    hasFrame, frame = video.read()
    if not hasFrame:
        cv2.waitKey()
        break

    resultImg, faceBoxes = highlightFace(faceNet, frame)
    if not faceBoxes:
        print("No face detected")
    else:
        for faceBox in faceBoxes:
            face = frame[max(0, faceBox[1] - padding):
                         min(faceBox[3] + padding, frame.shape[0] - 1),
                         max(0, faceBox[0] - padding):
                         min(faceBox[2] + padding, frame.shape[1] - 1)]

            blob = cv2.dnn.blobFromImage(face, 1.0, (227, 227), MODEL_MEAN_VALUES, swapRB=False)
            genderNet.setInput(blob)
            genderPreds = genderNet.forward()
            gender = genderList[genderPreds[0].argmax()]

            ageNet.setInput(blob)
            agePreds = ageNet.forward()
            age_range = agePreds[0].argmax() * 5

            if age_range <= 10:
                age = "(0-10)"
            elif age_range <= 20:
                age = "(10-20)"
            elif age_range <= 30:
                age = "(20-30)"
            elif age_range <= 50:
                age = "(30-50)"
            elif age_range <= 60:
                age = "(50-60)"
            else:
                age = "(60-80)"

            gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
            roi_gray = cv2.resize(gray, (48, 48), interpolation=cv2.INTER_AREA)
            if np.sum([roi_gray]) != 0:
                roi = roi_gray.astype('float') / 255.0
                roi = img_to_array(roi)
                roi = np.expand_dims(roi, axis=0)

                emotionPreds = emotionModel.predict(roi)[0]
                emotion = emotionList[emotionPreds.argmax()]

                # Calculate centroid of the face
                centroid_x = int((faceBox[0] + faceBox[2]) / 2)
                centroid_y = int((faceBox[1] + faceBox[3]) / 2)
                centroid = (centroid_x, centroid_y)

                # Check if a face with similar centroid exists
                existing_face_id = None
                for face_id, data in individual_predictions.items():
                    if data['centroid'] is not None:
                        dist = np.linalg.norm(np.array(data['centroid']) - np.array(centroid))
                        if dist < 50:  # Threshold distance for considering the same face
                            existing_face_id = face_id
                            break

                # Use existing face ID or generate a new one
                if existing_face_id is None:
                    face_id = len(individual_predictions)
                    individual_predictions[face_id]['centroid'] = centroid
                else:
                    face_id = existing_face_id

                if len(individual_predictions[face_id]['age']) < 10:
                    individual_predictions[face_id]['age'].append(age)
                if len(individual_predictions[face_id]['gender']) < 10:
                    individual_predictions[face_id]['gender'].append(gender)
                if len(individual_predictions[face_id]['emotion']) < 10:
                    individual_predictions[face_id]['emotion'].append(emotion)

                cv2.putText(resultImg, f'{gender}, {age}, {emotion}', (faceBox[0], faceBox[1] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2, cv2.LINE_AA)
                cv2.imshow("Detecting age, gender, and emotion", resultImg)
                
                # Check if 5 seconds have passed
                if time.time() - start_time >= 8:
                        print("Inserting data into MongoDB")
                        # Insert data into MongoDB
                        
                        individual_modes = {}
                        for face_id, predictions in individual_predictions.items():
                            timestamp = datetime.now()
                            date_added = timestamp.date()
                            time_added = timestamp.time()
                            date_added_str = date_added.isoformat()
                            time_added_str = time_added.isoformat()
                            
                            age_mode = calculate_mode(predictions['age'])
                            gender_mode = calculate_mode(predictions['gender'])
                            emotion_mode = calculate_mode(predictions['emotion'])
                            individual_modes[face_id] = {'age': age_mode, 'gender': gender_mode, 'emotion': emotion_mode}
                             
                            data_type = 'individual' if len(individual_predictions) == 1 else 'group'
                            face_count = 1 if data_type == 'individual' else len(individual_predictions)
 
                            new_document = {
                                '_id': get_next_sequence_value('your_collection_id'),
                                'Timestamp': timestamp,
                                'Date': date_added_str,
                                'Time': time_added_str,
                                'Age': age_mode,
                                'Gender': gender_mode,
                                'Emotion': emotion_mode,
                                'Gi': data_type,
                                'Gi_count': face_count
                            }
                            try:
                                collection.insert_one(new_document)
                                print(f'Document inserted: {new_document}')
                            except Exception as e:
                                print(f'Error inserting document: {e}')

                        # Reset timer
                        start_time = time.time()
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

video.release()
cv2.destroyAllWindows()

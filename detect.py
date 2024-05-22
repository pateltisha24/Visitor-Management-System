import cv2
import argparse
import numpy as np
from keras.models import load_model
from keras.preprocessing.image import img_to_array
from collections import defaultdict, Counter
import time
import dlib
import face_recognition

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

def calculate_mode(predictions):
    return Counter(predictions).most_common(1)[0][0]

# Load models
faceProto = r"opencv_face_detector.pbtxt"
faceModel = r"opencv_face_detector_uint8.pb"
ageProto = r"age_deploy.prototxt"
ageModel = r"age_net.caffemodel"
genderProto = r"gender_deploy.prototxt"
genderModel = r"gender_net.caffemodel"
emotionModelPath = r'model.h5'

MODEL_MEAN_VALUES = (78.4263377603, 87.7689143744, 114.895847746)
ageList = ['(0-4)', '(5-9)', '(10-14)', '(15-19)', '(20-24)', '(25-29)', '(30-34)', '(35-39)', '(40-44)', '(45-49)', '(50-54)', '(55-59)', '(60-64)', '(65-69)', '(70-74)', '(75-79)', '(80-84)', '(85-89)', '(90-94)', '(95-100)']
genderList = ['Male', 'Female']
emotionList = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']

faceNet = cv2.dnn.readNet(faceModel, faceProto)
ageNet = cv2.dnn.readNet(ageModel, ageProto)
genderNet = cv2.dnn.readNet(genderModel, genderProto)
emotionModel = load_model(emotionModelPath)

# Initialize dlib's face detector, shape predictor, and face recognizer model
detector = dlib.get_frontal_face_detector()
shape_predictor = dlib.shape_predictor("shape_predictor_68_face_landmarks.dat")
face_rec_model = dlib.face_recognition_model_v1("dlib_face_recognition_resnet_model_v1.dat")

parser = argparse.ArgumentParser()
parser.add_argument('--image')
args = parser.parse_args()

video_source = args.image if args.image else 0
padding = 20

individual_predictions = defaultdict(lambda: {'age': [], 'gender': [], 'emotion': [], 'face_encoding': None, 'frames': 0})

video = cv2.VideoCapture(video_source)

start_time = time.time()
while True:
    hasFrame, frame = video.read()
    if not hasFrame:
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

            # Convert the face to RGB
            rgb_face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
            
            # Detect face landmarks
            dlib_rect = dlib.rectangle(0, 0, face.shape[1], face.shape[0])
            landmarks = shape_predictor(rgb_face, dlib_rect)
            
            # Face encoding for recognition
            face_encoding = np.array(face_rec_model.compute_face_descriptor(rgb_face, landmarks))
            
            
            # Compare with existing face encodings
            matches = []
            for face_id, data in individual_predictions.items():
                if data['face_encoding'] is not None:
                    match = face_recognition.compare_faces([data['face_encoding']], face_encoding)
                    matches.append((face_id, match[0]))
            existing_face_id = None
            for face_id, is_match in matches:
                if is_match:
                    existing_face_id = face_id
                    break
            if existing_face_id is None:
                face_id = len(individual_predictions)
                individual_predictions[face_id]['face_encoding'] = face_encoding
            else:
                face_id = existing_face_id
                
            # Update face details
            blob = cv2.dnn.blobFromImage(face, 1.0, (227, 227), MODEL_MEAN_VALUES, swapRB=False)
            genderNet.setInput(blob)
            genderPreds = genderNet.forward()
            gender = genderList[genderPreds[0].argmax()]
            ageNet.setInput(blob)
            agePreds = ageNet.forward()
            age_range = agePreds[0].argmax() * 5
            age = ageList[min(len(ageList) - 1, age_range // 5)]
            gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
            roi_gray = cv2.resize(gray, (48, 48), interpolation=cv2.INTER_AREA)
            if np.sum([roi_gray]) != 0:
                roi = roi_gray.astype('float') / 255.0
                roi = img_to_array(roi)
                roi = np.expand_dims(roi, axis=0)
                emotionPreds = emotionModel.predict(roi)[0]
                emotion = emotionList[emotionPreds.argmax()]
                # Update individual predictions
                individual_predictions[face_id]['age'].append(age)
                individual_predictions[face_id]['gender'].append(gender)
                individual_predictions[face_id]['emotion'].append(emotion)
                individual_predictions[face_id]['frames'] += 1
                cv2.putText(resultImg, f'Person {face_id + 1}: {gender}, {age}, {emotion}', (faceBox[0], faceBox[1] - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2, cv2.LINE_AA)
                cv2.imshow("Detecting age, gender, and emotion", resultImg)
    # Remove predictions for faces not seen for a long time
    for face_id, data in list(individual_predictions.items()):
        if data['frames'] > 20:  # Adjust this threshold as needed
            del individual_predictions[face_id]

   # Display final predictions after 10 seconds
    if time.time() - start_time > 10:
        print("Final Predictions:")
        for face_id, predictions in individual_predictions.items():
            if predictions['frames'] > 0:  # Only display if the face has been detected recently
                age_mode = calculate_mode(predictions['age'])
                gender_mode = calculate_mode(predictions['gender'])
                emotion_mode = calculate_mode(predictions['emotion'])
                print(f"Person {face_id + 1}: Age: {age_mode}, Gender: {gender_mode}, Emotion: {emotion_mode}")
        break


    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

video.release()
cv2.destroyAllWindows()


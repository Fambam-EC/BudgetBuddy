import React from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import EmailValidator from '../Helpers/EmailValidator';
import { useBudget }  from '../Helpers/BudgetDataContext';

type ShareBudgetProps = {
    budget: {
        budgetId: string;
        name: string;
    };
};

function ShareBudgetComponent({ budget }: ShareBudgetProps) {
    const [modalVisible, setModalVisible] = React.useState(false);
    const [isSendEnabled, setIsSendEnabled] = React.useState(false);
    const [inviteEmail, setInviteEmail] = React.useState('');
    
    const handleValidationResponse = (data: boolean) => {
        setIsSendEnabled(data)
    } 
    const { budgetId } = useBudget();
    
    const sendShareBudget = async () => {
        try {
            const response = await fetch('https://onset-theatrics-subway.ngrok-free.dev/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail, budgetId, budgetName: budget.name }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Unable to share this budget.');
            }
            Alert.alert('Budget shared', 'The invitation was sent successfully.');
            setModalVisible(false);
        } catch (error) {
            Alert.alert(
                'Unable to share budget',
                error instanceof Error ? error.message : 'Please try again later.',
            );
        }
    }

    return(
        <View style={[styles.flexStart]}>
            <Pressable onPress={() => {
                // Handle share budget action here
                setModalVisible(true);
            }}>
                <Text style={[styles.rowBorder, styles.rowPadding, styles.boldText, styles.customFont]}>Share Budget</Text>
            </Pressable>
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => {
                    setModalVisible(false);
                }}
            >
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={styles.modalText}>Send Invite To Share Budget</Text>
                        <EmailValidator
                            setIsValidEmail={handleValidationResponse}
                            onEmailChange={setInviteEmail}
                        />
                        <View style={styles.buttonContainer}>
                        <Pressable
                            style={[styles.button, styles.buttonClose]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.textStyle}>Close</Text>
                        </Pressable>
                        <Pressable 
                            style={[styles.button, styles.buttonClose]} 
                            onPress={sendShareBudget}
                            disabled={!isSendEnabled}>
                            <Text style={styles.textStyle}>Share</Text>
                        </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
        );
};



    const styles = StyleSheet.create({
        flexStart: {
            justifyContent: 'flex-start',
            alignItems: 'flex-start'
        },
        input: {
            height: 40,
            borderColor: 'gray',
            borderWidth: 1,
            marginBottom: 15,
            paddingHorizontal: 10
        },
        buttonContainer: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 15
        },
        rowBorder: {
            borderWidth: 1,
            borderColor: '#000',
            borderRadius: 10
        },
        rowPadding: {
            padding: 10,
            marginVertical: 4,
            marginHorizontal: 8
        },
        boldText: {
            fontWeight: 'bold'
        },
        customFont: {
            fontFamily: 'OpenSans-Regular',
            fontSize: 12
        },
        centeredView: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
        },
        modalView: {
            margin: 20,
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 35,
            alignItems: 'center'
        },
        modalText: {
            marginBottom: 15,
            textAlign: 'center'
        },
        button: {
            borderRadius: 20,
            padding: 10,
            elevation: 2
        },
        buttonClose: {
            backgroundColor: '#2196F3'
        },
        textStyle: {
            color: 'white',
            fontWeight: 'bold',
            textAlign: 'center'
        }
    });
        
export default ShareBudgetComponent;
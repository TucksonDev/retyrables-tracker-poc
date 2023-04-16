const RETRYABLES_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/gvladika/arbitrum-retryables';
const BRIDGE_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/gvladika/arb-bridge-eth-nitro';
const MAX_RESULTS = 5;

async function querySubgraph(query: string, subgraphUrl: string): Promise<any> {
    const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });

    const { data } = await response.json();
    return data;
}

async function fetchPendingRetryables(): Promise<any> {
    const currTimestamp = Math.floor(new Date().getTime() / 1000);

    const query = `
        query {
            retryables(
                first: 20,
                where: {
                    redeemedAtTimestamp: null,
                    timeoutTimestamp_gt: ${currTimestamp}
                }
            ) {
                id
                status
                retryTxHash
                timeoutTimestamp
                createdAtTimestamp
                createdAtBlockNumber
                createdAtTxHash
                redeemedAtTimestamp
                isAutoRedeemed
                sequenceNum
                donatedGas
                gasDonor
                maxRefund
                submissionFeeRefund
                requestId
                l1BaseFee
                deposit
                callvalue
                gasFeeCap
                gasLimit
                maxSubmissionFee
                feeRefundAddress
                beneficiary
                retryTo
                retryData
            }
        }
    `;
    
    const result = await querySubgraph(query, RETRYABLES_SUBGRAPH_URL);
    return result.retryables;
}

async function fetchInformationFromRetryable(retryableCreationTxHash: string): Promise<any> {
    // Query the creation tx hash
    const queryForCreation = `
        query {
            retryables(
                first: 1,
                where: {
                  retryableTicketID: "${retryableCreationTxHash}"
                }
              ) {
                id
                sender
                isEthDeposit
                value
                destAddr
                retryableTicketID
                l2Calldata
                timestamp
                transactionHash
                blockCreatedAt
            }
        }
    `;
    const result = await querySubgraph(queryForCreation, BRIDGE_SUBGRAPH_URL);
    if (result.retryables.length <= 0) {
        return false;
    }
    const retryableCreationTx = result.retryables[0];

    // Query the deposit transaction hash
    const queryForDeposit = `
        query {
            deposits(
                first: 1,
                where: {
                    transactionHash: "${retryableCreationTx.transactionHash}"
                }
            ) {
                id
                type
                sender
                receiver
                ethValue
                l1Token {
                    id
                    name
                    symbol
                    decimals
                    registeredAtBlock
                }
                sequenceNumber
                l2TicketId
                tokenAmount
                isClassic
                timestamp
                transactionHash
                blockCreatedAt
            }
        }
    `;
    const depositResult = await querySubgraph(queryForDeposit, BRIDGE_SUBGRAPH_URL);
    if (depositResult.deposits.length > 0) {
        retryableCreationTx.depositTx = depositResult.deposits[0];
    } else {
        retryableCreationTx.depositTx = null;
    }

    return retryableCreationTx;
}

export async function fetchPendingRetryablesFromAddress(address: string): Promise<any> {
    const pendingRetryables = await fetchPendingRetryables();
    if (pendingRetryables.length <= 0) {
        return [];
    }

    const result: any[] = [];
    for (const retryable of pendingRetryables) {
        const retryableInformation = await fetchInformationFromRetryable(retryable.createdAtTxHash);

        // For some reason there isn't any retryable information (WEIRD!)
        if (!retryableInformation) 
        {
            continue;
        }

        if (retryableInformation.depositTx) {
            // It is using the bridge to do a deposit
            retryableInformation.isDeposit = true;
            if (retryableInformation.depositTx.sender.toLowerCase() == address.toLowerCase()) {
                retryable.creationTx = retryableInformation;
                result.push(retryable);
            }
        } else {
            // It is just sending a message through the DelayedInbox
            retryableInformation.isDeposit = false;
            if (retryableInformation.sender.toLowerCase() === address.toLowerCase()) {
                retryable.creationTx = retryableInformation;
                result.push(retryable);
            }
        }
    }

    return result;
}

export async function fetchLatestDepositRetryablesFromAddress(address: string, results: number = 20): Promise<any> {
    if (results > MAX_RESULTS) {
        results = MAX_RESULTS;
    }

    // Query the deposit transactions
    const queryForDeposit = `
        query {
            deposits(
                first: ${results},
                where: {
                    sender: "${address}"
                },
                orderBy: timestamp,
                orderDirection: desc
            ) {
                id
                type
                sender
                receiver
                ethValue
                l1Token {
                    id
                    name
                    symbol
                    decimals
                    registeredAtBlock
                }
                sequenceNumber
                l2TicketId
                tokenAmount
                isClassic
                timestamp
                transactionHash
                blockCreatedAt
            }
        }
    `;
    const depositResult = await querySubgraph(queryForDeposit, BRIDGE_SUBGRAPH_URL);
    if (depositResult.deposits.length <= 0) {
        return [];
    }

    const result: any[] = [];
    for (const deposit of depositResult.deposits) {
        // Query the submission tx hash
        const queryForSubmission = `
            query {
                retryables(
                    first: 1,
                    where: {
                        transactionHash: "${deposit.transactionHash}"
                    }
                ) {
                    id
                    sender
                    isEthDeposit
                    value
                    destAddr
                    retryableTicketID
                    l2Calldata
                    timestamp
                    transactionHash
                    blockCreatedAt
                }
            }
        `;
        const resultForSubmission = await querySubgraph(queryForSubmission, BRIDGE_SUBGRAPH_URL);

        // For some reason there isn't any retryable information (WEIRD!)
        if (resultForSubmission.retryables.length <= 0) 
        {
            continue;
        }
        const submissionTx = resultForSubmission.retryables[0];
        
        // Query the L2 retryable ticket
        const queryForL2Ticket = `
            query {
                retryables(
                    first: 1,
                    where: {
                        createdAtTxHash: "${submissionTx.retryableTicketID}"
                    }
                ) {
                    id
                    status
                    retryTxHash
                    timeoutTimestamp
                    createdAtTimestamp
                    createdAtBlockNumber
                    createdAtTxHash
                    redeemedAtTimestamp
                    isAutoRedeemed
                    sequenceNum
                    donatedGas
                    gasDonor
                    maxRefund
                    submissionFeeRefund
                    requestId
                    l1BaseFee
                    deposit
                    callvalue
                    gasFeeCap
                    gasLimit
                    maxSubmissionFee
                    feeRefundAddress
                    beneficiary
                    retryTo
                    retryData
                }
            }
        `;
    
        const resultForL2Ticket = await querySubgraph(queryForL2Ticket, RETRYABLES_SUBGRAPH_URL);
        // For some reason there isn't any retryable information (WEIRD!)
        if (resultForL2Ticket.retryables.length <= 0) 
        {
            continue;
        }

        submissionTx.l2Ticket = resultForL2Ticket.retryables[0];
        deposit.submissionTx = submissionTx;
        result.push(deposit);
    }

    return result;
}

export async function fetchLatestNonDepositRetryablesFromAddress(address: string, results: number = 20): Promise<any> {
    if (results > MAX_RESULTS) {
        results = MAX_RESULTS;
    }

    // Query the submission tx hash
    const queryForSubmission = `
        query {
            retryables(
                first: ${results},
                where: {
                    sender: "${address}"
                }
            ) {
                id
                sender
                isEthDeposit
                value
                destAddr
                retryableTicketID
                l2Calldata
                timestamp
                transactionHash
                blockCreatedAt
            }
        }
    `;
    const resultForSubmission = await querySubgraph(queryForSubmission, BRIDGE_SUBGRAPH_URL);
    if (resultForSubmission.retryables.length <= 0) {
        return [];
    }

    const result: any[] = [];
    for (const retryable of resultForSubmission.retryables) {
        // Query the L2 retryable ticket
        const queryForL2Ticket = `
            query {
                retryables(
                    first: 1,
                    where: {
                        createdAtTxHash: "${retryable.retryableTicketID}"
                    }
                ) {
                    id
                    status
                    retryTxHash
                    timeoutTimestamp
                    createdAtTimestamp
                    createdAtBlockNumber
                    createdAtTxHash
                    redeemedAtTimestamp
                    isAutoRedeemed
                    sequenceNum
                    donatedGas
                    gasDonor
                    maxRefund
                    submissionFeeRefund
                    requestId
                    l1BaseFee
                    deposit
                    callvalue
                    gasFeeCap
                    gasLimit
                    maxSubmissionFee
                    feeRefundAddress
                    beneficiary
                    retryTo
                    retryData
                }
            }
        `;
    
        const resultForL2Ticket = await querySubgraph(queryForL2Ticket, RETRYABLES_SUBGRAPH_URL);
        // For some reason there isn't any retryable information (WEIRD!)
        if (resultForL2Ticket.retryables.length <= 0) 
        {
            continue;
        }

        retryable.l2Ticket = resultForL2Ticket.retryables[0];
        result.push(retryable);
    }

    return result;
}
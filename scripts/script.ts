import { isAddress } from 'ethers';
import { fetchPendingRetryablesFromAddress, fetchLatestDepositRetryablesFromAddress, fetchLatestNonDepositRetryablesFromAddress } from './subgraphs';

function isValidEthereumAddress(address: string): boolean {
    return isAddress(address);
}

function getURLParameter(paramName: string): string | null {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    return urlParams.get(paramName);
}

async function showPendingRetryablesFromAddress(address: string): Promise<void> {
    // Getting all pending retryables
    const retryables = await fetchPendingRetryablesFromAddress(address);

    const resultsContainer = document.getElementById('pendingResult') as HTMLDivElement;
    resultsContainer.innerHTML = `<h2>Pending retryables from address ${address}</h2>`;

    if (retryables.length > 0) {
        retryables.forEach( async (retryable: any) => {
            const retryableInfo = document.createElement('div');

            retryableInfo.innerHTML = `
                <p>ID: ${retryable.id}</p>
                <p>Status: ${retryable.status}</p>
                <p>Timeout Timestamp: ${new Date( (retryable.timeoutTimestamp * 1000) )}</p>
                <p>Sent from: ${retryable.creationTx.sender}</p>
                <p>Is Deposit (i.e., used Arbitrum Bridge): ${retryable.creationTx.isDeposit}</p>
                <p>Full object</p><pre class="fullObjectInfo">${JSON.stringify(retryable)}</pre>
                <hr />
            `;
            resultsContainer.appendChild(retryableInfo);
        });
    } else {
        resultsContainer.appendChild(document.createTextNode('No retryables found'));
    }
    
    const divider = document.createElement('hr');
    resultsContainer.appendChild(divider);
    resultsContainer.appendChild(divider);

    resultsContainer.hidden = false;
}

async function showLatestDepositRetryablesFromAddress(address: string): Promise<void> {
    // Getting all pending retryables
    const retryables = await fetchLatestDepositRetryablesFromAddress(address);

    const resultsContainer = document.getElementById('latestResult') as HTMLDivElement;
    resultsContainer.innerHTML = `<h2>Latest deposit retryables from address ${address}</h2>`;

    if (retryables.length > 0) {
        retryables.forEach( async (retryable: any) => {
            const retryableInfo = document.createElement('div');

            retryableInfo.innerHTML = `
                <p>ID: ${retryable.id}</p>
                <p>Status: ${retryable.submissionTx.l2Ticket.status}</p>
                <p>Timeout Timestamp: ${new Date( (retryable.submissionTx.l2Ticket.timeoutTimestamp * 1000) )}</p>
                <p>Sent from: ${retryable.sender}</p>
                <p>Token information:</p><pre>${JSON.stringify(retryable.l1Token)}</pre>
                <p>Full object</p><pre class="fullObjectInfo">${JSON.stringify(retryable)}</pre>
                <hr />
            `;
            resultsContainer.appendChild(retryableInfo);
        });
    } else {
        resultsContainer.appendChild(document.createTextNode('No retryables found'));
    }
    
    resultsContainer.hidden = false;
}

async function showLatestNonDepositRetryablesFromAddress(address: string): Promise<void> {
    // Getting all pending retryables
    const retryables = await fetchLatestNonDepositRetryablesFromAddress(address);

    const resultsContainer = document.getElementById('latestResult') as HTMLDivElement;
    resultsContainer.innerHTML = `<h2>Latest NON deposit retryables from address ${address}</h2>`;

    if (retryables.length > 0) {
        retryables.forEach( async (retryable: any) => {
            const retryableInfo = document.createElement('div');

            retryableInfo.innerHTML = `
                <p>ID: ${retryable.id}</p>
                <p>Status: ${retryable.l2Ticket.status}</p>
                <p>Timeout Timestamp: ${new Date( (retryable.l2Ticket.timeoutTimestamp * 1000) )}</p>
                <p>Sent from: ${retryable.sender}</p>
                <p>Full object</p><pre class="fullObjectInfo">${JSON.stringify(retryable)}</pre>
                <hr />
            `;
            resultsContainer.appendChild(retryableInfo);
        });
    } else {
        resultsContainer.appendChild(document.createTextNode('No retryables found'));
    }
    
    resultsContainer.hidden = false;
}

window.addEventListener('DOMContentLoaded', () => {
    const addressForm = document.getElementById('addressForm') as HTMLFormElement;
    const addressInput = document.getElementById('addressInput') as HTMLInputElement;
    const onlyDepositsCheckbox = document.getElementById('onlyDepositsCheckbox') as HTMLInputElement;

    addressForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const address = addressInput.value.trim();
        const onlyDeposits = onlyDepositsCheckbox.checked;
        const queryParams = new URLSearchParams();
        queryParams.set('address', address);
        if (onlyDeposits) {
            queryParams.set('onlyDeposits', 'true');
        }
        window.location.href = `?${queryParams.toString()}`;
    });

    const addressParam = getURLParameter('address');
    const onlyDepositsParam = getURLParameter('onlyDeposits');
    
    if (addressParam) {
        if (!isValidEthereumAddress(addressParam)) {
            alert('Please enter a valid Ethereum address.');
            return;
        }
        addressForm.hidden = true;

        /////////////////////////////
        // Show pending retryables
        /////////////////////////////
        showPendingRetryablesFromAddress(addressParam);

        /////////////////////////////
        // Show latest retryables
        /////////////////////////////
        if (onlyDepositsParam) {
            showLatestDepositRetryablesFromAddress(addressParam);
        } else {
            showLatestNonDepositRetryablesFromAddress(addressParam);
        }
    }
});


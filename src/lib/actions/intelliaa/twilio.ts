"use server";

import twilio from "twilio";

const accountSid = process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID;
const authToken = process.env.NEXT_PUBLIC_TWILIO_AUTH_TOKEN;

const client = twilio(accountSid, authToken);

interface NumberDetails {
  number: string;
  price: string;
}

interface PricingInfo {
  numberType: string;
  basePrice: number;
  currentPrice: number;
}

interface CountryInfo {
  country: string;
  isoCountry: string;
}

interface ListAvailableNumbersResult {
  numbers: NumberDetails[];
  totalPages: number;
}

async function fetchPhoneNumberCountry(
  countryCode: string
): Promise<PricingInfo[] | null> {
  try {
    console.log(
      `Fetching pricing information for country code: ${countryCode}`
    );
    const countryPricing = await client.pricing.v1.phoneNumbers
      .countries(countryCode)
      .fetch();

    if (!countryPricing || !countryPricing.phoneNumberPrices) {
      console.error(
        "No pricing information found for country code:",
        countryCode
      );
      return null;
    }

    const pricingInfo: PricingInfo[] = countryPricing.phoneNumberPrices.map(
      (price) => ({
        basePrice: price?.basePrice || 0,
        currentPrice: price?.currentPrice || 0,
        numberType: price?.numberType || "N/A",
      })
    );

    console.log("Pricing information fetched:", pricingInfo);

    if (!pricingInfo) {
      console.error(
        "No pricing information found for country code:",
        countryCode
      );
      return null;
    }

    return pricingInfo;
  } catch (error) {
    console.error("Error fetching country pricing:", error);
    return null;
  }
}

async function listAvailableNumbers(
  type: "local" | "toll free",
  countryCode: string,
  page: number = 1,
  pageSize: number = 10
): Promise<ListAvailableNumbersResult> {
  try {
    const pricing = await fetchPhoneNumberCountry(countryCode);

    if (!pricing) {
      console.error("No pricing information available.");
      return {
        numbers: [],
        totalPages: 1,
      };
    }

    let availableNumbers: any[] = [];
    let totalPages = 0;

    const fetchPage = async (pageNumber: number) => {
      const options: any = { limit: pageSize };
      if (pageNumber > 1) {
        options.page = pageNumber;
      }

      let numbers;

      if (type === "local") {
        numbers = await client
          .availablePhoneNumbers(countryCode)
          .local.list(options);
      } else if (type === "toll free") {
        numbers = await client
          .availablePhoneNumbers(countryCode)
          .tollFree.list(options);
      } else {
        throw new Error('Invalid type specified. Use "local" or "toll free".');
      }

      return numbers;
    };

    // Solo obtener la página solicitada
    const pageResults = await fetchPage(page);

    totalPages = Math.ceil(pageResults.length / pageSize);

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageResultsSlice = pageResults.slice(startIndex, endIndex);

    const priceInfo = pricing.find((p) => p.numberType === type);

    const priceInfoString = priceInfo?.currentPrice.toString() || "0";

    const numberDetails = pageResultsSlice.map((number) => ({
      number: number.phoneNumber,
      price: priceInfo ? `$ ${priceInfoString} c/mes` : "N/A",
    }));

    return {
      numbers: numberDetails,
      totalPages: totalPages,
    };
  } catch (error) {
    console.error("Error fetching available numbers:", error);
    return {
      numbers: [],
      totalPages: 1,
    };
  }
}

async function listVoiceCountry(): Promise<CountryInfo[]> {
  try {
    const countries = await client.pricing.v2.voice.countries.list();

    const countryDetails: CountryInfo[] = countries.map((c) => ({
      country: c.country,
      isoCountry: c.isoCountry,
    }));

    return countryDetails;
  } catch (error) {
    console.error("Error fetching voice countries:", error);
    return [];
  }
}

async function listActiveNumbers(): Promise<string[]> {
  try {
    const numbers = await client.incomingPhoneNumbers.list();

    const activeNumbers = numbers.map((number) => number.phoneNumber);

    return activeNumbers;
  } catch (error) {
    console.error("Error fetching active numbers:", error);
    return [];
  }
}

export { listAvailableNumbers, listVoiceCountry, listActiveNumbers };

import * as React from "react";
import { useFrontload } from "react-frontload";
import { ApiContext } from "../api-client/inventory-api";
import ItemLabel from "./ItemLabel";


/**
 * Home page component
 * 
 * Should show general statistics, recent transactions, information of general interest.
 * 
 * @returns ReactElement
 */
function Home() {
  const { data, frontloadMeta, setData } = useFrontload(
    "home-component",
    async ({ api }) => ({ version: await api.getVersion() })
  );
  const api = React.useContext(ApiContext);

  if (frontloadMeta.pending) return <div>Loading</div>;
  if (frontloadMeta.error) throw new Error("API Error\n"+frontloadMeta);
  
  return (
    <div>
      <div
        onClick={() =>
          api.getVersion().then((version) =>
            setData(() => ({
              version,
            }))
          )
        }
      >
        Api Version: {data.version}
      </div>
      <div>
        example bin: <ItemLabel label={"BIN000024"} />
      </div>
    </div>
  );
}

export default Home;

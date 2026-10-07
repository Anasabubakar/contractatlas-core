#![no_std]
//! ContractAtlas test fixture: a minimal upgradeable contract.
//!
//! It exists only so the checker has a real deployed contract whose executable
//! can be upgraded. It is NOT an audited contract. Any "audit" referenced in
//! the fixture manifests is a fictional label used to exercise the checker.

use soroban_sdk::{contract, contractimpl, contracttype, BytesN, Address, Env};

#[contracttype]
enum DataKey {
    Admin,
}

#[contract]
pub struct UpgradeableFixture;

#[contractimpl]
impl UpgradeableFixture {
    /// One-time initialisation. Fails if called again.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Replaces this contract's executable. Only the stored admin may call it.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialised");
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Which build of the fixture is running.
    pub fn version(_env: Env) -> u32 {
        if cfg!(feature = "v2") {
            2
        } else {
            1
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn init_once_only() {
        let env = Env::default();
        let id = env.register(UpgradeableFixture, ());
        let c = UpgradeableFixtureClient::new(&env, &id);
        let admin = Address::generate(&env);
        c.init(&admin);
        assert!(c.try_init(&admin).is_err());
    }

    #[test]
    fn version_reports_build() {
        let env = Env::default();
        let id = env.register(UpgradeableFixture, ());
        let c = UpgradeableFixtureClient::new(&env, &id);
        assert_eq!(c.version(), if cfg!(feature = "v2") { 2 } else { 1 });
    }
}
